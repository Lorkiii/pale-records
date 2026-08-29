// Owns Recitation sessions, deletion, response-only drafts, and atomic historical saves.
import {
  Prisma,
  RecitationMark,
} from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type {
  RecitationMarkCode,
  RecitationRecordInput,
} from "../validations/recitation.schema.js";
import type { RecitationSessionRecord } from "../validations/recitation.response.js";

type RecitationStudentDatabaseRecord = {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
};

type RecitationDatabaseRecord = {
  id: string;
  studentId: string;
  mark: RecitationMark | null;
  student: RecitationStudentDatabaseRecord;
};

type RecitationSessionDatabaseRecord = {
  id: string;
  classId: string;
  sessionDate: Date;
  rosterInitializedAt: Date | null;
  recitationRecords: RecitationDatabaseRecord[];
  class: {
    enrollments: Array<{ student: RecitationStudentDatabaseRecord }>;
  };
};

type RecitationClassSnapshot = {
  archivedAt: Date | null;
};

type RecitationClassSessionsDatabaseRecord = {
  recitationSessions: RecitationSessionDatabaseRecord[];
};

type SaveRecitationRecordData = {
  studentId: string;
  mark: RecitationMark | null;
};

type SaveRecitationRecordsDatabaseResult =
  | { status: "saved"; session: RecitationSessionDatabaseRecord }
  | { status: "session_not_found" }
  | { status: "roster_mismatch" };

export type RecitationServiceDependencies = {
  findClassSnapshot: (classId: string) => Promise<RecitationClassSnapshot | null>;
  insertSession: (
    classId: string,
    sessionDate: Date,
  ) => Promise<RecitationSessionDatabaseRecord>;
  findClassSessions: (
    classId: string,
    monthStart: Date,
    nextMonthStart: Date,
  ) => Promise<RecitationClassSessionsDatabaseRecord | null>;
  findSession: (
    sessionId: string,
  ) => Promise<RecitationSessionDatabaseRecord | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  saveSessionRecords: (
    sessionId: string,
    records: SaveRecitationRecordData[],
  ) => Promise<SaveRecitationRecordsDatabaseResult>;
};

export class RecitationSessionConflictError extends Error {
  constructor() {
    super("The class already has a Recitation session on this date.");
    this.name = "RecitationSessionConflictError";
  }
}

class RecitationRosterMismatchError extends Error {
  constructor() {
    super("The submitted roster does not match the current class enrollment.");
    this.name = "RecitationRosterMismatchError";
  }
}

const recitationStudentSelect = {
  id: true,
  studentNo: true,
  firstName: true,
  lastName: true,
} as const;

const recitationSessionSelect = {
  id: true,
  classId: true,
  sessionDate: true,
  rosterInitializedAt: true,
  recitationRecords: {
    take: 101,
    select: {
      id: true,
      studentId: true,
      mark: true,
      student: { select: recitationStudentSelect },
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
      { studentId: "asc" },
    ],
  },
  class: {
    select: {
      enrollments: {
        take: 101,
        where: {
          student: { archivedAt: null },
        },
        select: {
          student: { select: recitationStudentSelect },
        },
        orderBy: [
          { student: { lastName: "asc" } },
          { student: { firstName: "asc" } },
          { studentId: "asc" },
        ],
      },
    },
  },
} satisfies Prisma.RecitationSessionSelect;

// Recognizes only the class/date uniqueness rule used for manual session creation.
function isRecitationSessionUniqueConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  return (
    target === "RecitationSession_classId_sessionDate_key" ||
    (Array.isArray(target) &&
      target.includes("classId") &&
      target.includes("sessionDate"))
  );
}

// Converts a validated calendar date to Prisma's date-only transport value.
function toDatabaseDate(sessionDate: string) {
  return new Date(`${sessionDate}T00:00:00.000Z`);
}

// Converts a PostgreSQL date value to the stable YYYY-MM-DD API representation.
function toDateOnly(sessionDate: Date) {
  return sessionDate.toISOString().slice(0, 10);
}

// Returns stable inclusive/exclusive UTC values for one validated calendar month.
function getRecitationMonthBounds(year: number, month: number) {
  return {
    monthStart: new Date(Date.UTC(year, month - 1, 1)),
    nextMonthStart: new Date(Date.UTC(year, month, 1)),
  };
}

// Compares complete student sets without relying on request ordering.
export function hasExactRecitationStudentSet(
  storedStudentIds: string[],
  submittedStudentIds: string[],
) {
  if (storedStudentIds.length !== submittedStudentIds.length) {
    return false;
  }

  const storedStudentIdSet = new Set(storedStudentIds);
  return submittedStudentIds.every((studentId) => storedStudentIdSet.has(studentId));
}

const defaultDependencies: RecitationServiceDependencies = {
  // Loads only class existence and archive state needed for manual creation.
  findClassSnapshot: (classId) =>
    prisma.class.findUnique({
      where: { id: classId },
      select: { archivedAt: true },
    }),
  // Creates only the session; current enrollments remain response-only draft records.
  insertSession: async (classId, sessionDate) => {
    try {
      return await prisma.recitationSession.create({
        data: { classId, sessionDate },
        select: recitationSessionSelect,
      });
    } catch (error) {
      if (isRecitationSessionUniqueConflict(error)) {
        throw new RecitationSessionConflictError();
      }

      throw error;
    }
  },
  // Loads one existing class and at most 31 sessions from the requested month.
  findClassSessions: (classId, monthStart, nextMonthStart) =>
    prisma.class.findUnique({
      where: { id: classId },
      select: {
        recitationSessions: {
          where: {
            sessionDate: { gte: monthStart, lt: nextMonthStart },
          },
          take: 31,
          orderBy: [{ sessionDate: "desc" }, { id: "asc" }],
          select: recitationSessionSelect,
        },
      },
    }),
  // Loads one complete safe session source by identifier.
  findSession: (sessionId) =>
    prisma.recitationSession.findUnique({
      where: { id: sessionId },
      select: recitationSessionSelect,
    }),
  // Deletes the session and relies on the database cascade for its roster records.
  deleteSession: async (sessionId) => {
    const result = await prisma.recitationSession.deleteMany({
      where: { id: sessionId },
    });
    return result.count === 1;
  },
  // Claims first initialization before reading enrollment, then writes the exact roster atomically.
  saveSessionRecords: async (sessionId, records) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        const session = await transaction.recitationSession.findUnique({
          where: { id: sessionId },
          select: {
            classId: true,
            rosterInitializedAt: true,
          },
        });

        if (!session) {
          return { status: "session_not_found" };
        }

        let isInitializing = false;
        if (session.rosterInitializedAt === null) {
          const claimed = await transaction.recitationSession.updateMany({
            where: { id: sessionId, rosterInitializedAt: null },
            data: { rosterInitializedAt: new Date() },
          });
          isInitializing = claimed.count === 1;
        }

        const submittedStudentIds = records.map((record) => record.studentId);
        if (isInitializing) {
          const enrollments = await transaction.studentEnrollment.findMany({
            where: {
              classId: session.classId,
              student: { archivedAt: null },
            },
            take: 101,
            select: { studentId: true },
            orderBy: { studentId: "asc" },
          });
          const currentStudentIds = enrollments.map((enrollment) => enrollment.studentId);

          if (!hasExactRecitationStudentSet(currentStudentIds, submittedStudentIds)) {
            throw new RecitationRosterMismatchError();
          }

          if (records.length > 0) {
            await transaction.recitationRecord.createMany({
              data: records.map((record) => ({
                sessionId,
                studentId: record.studentId,
                mark: record.mark,
              })),
            });
          }
        } else {
          const storedSession = await transaction.recitationSession.findUnique({
            where: { id: sessionId },
            select: {
              recitationRecords: {
                take: 101,
                select: { studentId: true },
                orderBy: { studentId: "asc" },
              },
            },
          });

          if (!storedSession) {
            return { status: "session_not_found" };
          }

          const storedStudentIds = storedSession.recitationRecords.map(
            (record) => record.studentId,
          );
          if (!hasExactRecitationStudentSet(storedStudentIds, submittedStudentIds)) {
            return { status: "roster_mismatch" };
          }

          for (const record of records) {
            await transaction.recitationRecord.update({
              where: {
                sessionId_studentId: {
                  sessionId,
                  studentId: record.studentId,
                },
              },
              data: { mark: record.mark },
            });
          }
        }

        const savedSession = await transaction.recitationSession.findUnique({
          where: { id: sessionId },
          select: recitationSessionSelect,
        });

        return savedSession
          ? { status: "saved", session: savedSession }
          : { status: "session_not_found" };
      });
    } catch (error) {
      if (error instanceof RecitationRosterMismatchError) {
        return { status: "roster_mismatch" };
      }

      throw error;
    }
  },
};

// Maps public Recitation mark values explicitly into the generated database enum.
export function toDatabaseRecitationMark(
  mark: RecitationMarkCode | null,
): RecitationMark | null {
  switch (mark) {
    case "CHECK":
      return RecitationMark.CHECK;
    case "X":
      return RecitationMark.X;
    case null:
      return null;
  }
}

// Maps generated database values to the stable public Recitation mark contract.
export function toRecitationMarkCode(
  mark: RecitationMark | null,
): RecitationMarkCode | null {
  switch (mark) {
    case RecitationMark.CHECK:
      return "CHECK";
    case RecitationMark.X:
      return "X";
    case null:
      return null;
  }
}

// Maps persisted records or current-enrollment drafts to one safe public session.
function toRecitationSessionRecord(
  session: RecitationSessionDatabaseRecord,
): RecitationSessionRecord {
  const isRosterInitialized = session.rosterInitializedAt !== null;
  const records = isRosterInitialized
    ? session.recitationRecords.map((record) => ({
      id: record.id,
      student: {
        id: record.student.id,
        studentNo: record.student.studentNo,
        firstName: record.student.firstName,
        lastName: record.student.lastName,
      },
      mark: toRecitationMarkCode(record.mark),
    }))
    : session.class.enrollments.map((enrollment) => ({
      id: null,
      student: {
        id: enrollment.student.id,
        studentNo: enrollment.student.studentNo,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
      },
      mark: null,
    }));

  records.sort(
    (left, right) =>
      left.student.lastName.localeCompare(right.student.lastName) ||
      left.student.firstName.localeCompare(right.student.firstName) ||
      left.student.id.localeCompare(right.student.id),
  );

  return {
    id: session.id,
    classId: session.classId,
    sessionDate: toDateOnly(session.sessionDate),
    isRosterInitialized,
    records,
  };
}

export type CreateRecitationSessionResult =
  | { status: "created"; session: RecitationSessionRecord }
  | { status: "class_not_found" }
  | { status: "class_archived" }
  | { status: "session_exists" };

// Creates one manual date-only session and returns current enrollment as an unsaved draft.
export async function createRecitationSession(
  classId: string,
  sessionDate: string,
  dependencies: RecitationServiceDependencies = defaultDependencies,
): Promise<CreateRecitationSessionResult> {
  const classSnapshot = await dependencies.findClassSnapshot(classId);

  if (!classSnapshot) {
    return { status: "class_not_found" };
  }

  if (classSnapshot.archivedAt !== null) {
    return { status: "class_archived" };
  }

  try {
    const session = await dependencies.insertSession(
      classId,
      toDatabaseDate(sessionDate),
    );
    return { status: "created", session: toRecitationSessionRecord(session) };
  } catch (error) {
    if (error instanceof RecitationSessionConflictError) {
      return { status: "session_exists" };
    }

    throw error;
  }
}

export type ListRecitationSessionsResult =
  | { status: "found"; sessions: RecitationSessionRecord[] }
  | { status: "class_not_found" };

// Loads one class's bounded newest-first Recitation sessions for a calendar month.
export async function listRecitationSessions(
  classId: string,
  year: number,
  month: number,
  dependencies: RecitationServiceDependencies = defaultDependencies,
): Promise<ListRecitationSessionsResult> {
  const { monthStart, nextMonthStart } = getRecitationMonthBounds(year, month);
  const classRecord = await dependencies.findClassSessions(
    classId,
    monthStart,
    nextMonthStart,
  );

  if (!classRecord) {
    return { status: "class_not_found" };
  }

  return {
    status: "found",
    sessions: classRecord.recitationSessions
      .slice(0, 31)
      .map(toRecitationSessionRecord),
  };
}

// Loads one session with either saved history or a current-enrollment draft roster.
export async function loadRecitationSession(
  sessionId: string,
  dependencies: RecitationServiceDependencies = defaultDependencies,
) {
  const session = await dependencies.findSession(sessionId);
  return session ? toRecitationSessionRecord(session) : null;
}

// Removes one complete persisted date and its cascading Recitation records.
export function deleteRecitationSession(
  sessionId: string,
  dependencies: RecitationServiceDependencies = defaultDependencies,
) {
  return dependencies.deleteSession(sessionId);
}

export type SaveRecitationRecordsResult =
  | { status: "saved"; session: RecitationSessionRecord }
  | { status: "session_not_found" }
  | { status: "student_duplicate" }
  | { status: "roster_mismatch" };

// Initializes the current roster on first save or updates only the stored historical roster.
export async function saveRecitationRecords(
  sessionId: string,
  records: RecitationRecordInput[],
  dependencies: RecitationServiceDependencies = defaultDependencies,
): Promise<SaveRecitationRecordsResult> {
  const submittedStudentIds = records.map((record) => record.studentId);
  if (new Set(submittedStudentIds).size !== submittedStudentIds.length) {
    return { status: "student_duplicate" };
  }

  const result = await dependencies.saveSessionRecords(
    sessionId,
    records.map((record) => ({
      studentId: record.studentId,
      mark: toDatabaseRecitationMark(record.mark),
    })),
  );

  return result.status === "saved"
    ? { status: "saved", session: toRecitationSessionRecord(result.session) }
    : result;
}
