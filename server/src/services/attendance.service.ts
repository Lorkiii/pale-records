// Owns monthly Attendance generation, response-only draft rosters, and atomic historical saves.
import {
  AttendanceStatus,
  Prisma,
} from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type {
  AttendanceRecordInput,
  AttendanceStatusCode,
} from "../validations/attendance.schema.js";
import type { AttendanceSessionRecord } from "../validations/attendance.response.js";

type AttendanceStudentDatabaseRecord = {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
};

type AttendanceDatabaseRecord = {
  id: string;
  studentId: string;
  status: AttendanceStatus | null;
  remarks: string | null;
  student: AttendanceStudentDatabaseRecord;
};

type AttendanceSessionDatabaseRecord = {
  id: string;
  classId: string;
  classScheduleId: string | null;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
  rosterInitializedAt: Date | null;
  attendanceRecords: AttendanceDatabaseRecord[];
  class: {
    enrollments: Array<{ student: AttendanceStudentDatabaseRecord }>;
  };
};

type AttendanceClassSnapshot = {
  archivedAt: Date | null;
  classSchedules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
};

export type AttendanceClassMonthSnapshot = AttendanceClassSnapshot & {
  startDate: Date | null;
  endDate: Date | null;
};

export type CreateAttendanceSessionData = {
  classId: string;
  classScheduleId: string | null;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
};

type SaveAttendanceRecordData = {
  studentId: string;
  status: AttendanceStatus | null;
  remarks: string | null;
};

type EnsureAttendanceMonthDatabaseResult =
  | { status: "ensured"; sessions: AttendanceSessionDatabaseRecord[] }
  | { status: "class_not_found" }
  | { status: "class_archived" };

type SaveAttendanceRecordsDatabaseResult =
  | { status: "saved"; session: AttendanceSessionDatabaseRecord }
  | { status: "session_not_found" }
  | { status: "roster_mismatch" };

export type AttendanceServiceDependencies = {
  findClassSnapshot: (classId: string) => Promise<AttendanceClassSnapshot | null>;
  insertSession: (
    data: CreateAttendanceSessionData,
  ) => Promise<AttendanceSessionDatabaseRecord>;
  classExists: (classId: string) => Promise<boolean>;
  findClassSessions: (
    classId: string,
  ) => Promise<AttendanceSessionDatabaseRecord[]>;
  findSession: (
    sessionId: string,
  ) => Promise<AttendanceSessionDatabaseRecord | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  ensureSessionMonth: (
    classId: string,
    year: number,
    month: number,
  ) => Promise<EnsureAttendanceMonthDatabaseResult>;
  saveSessionRecords: (
    sessionId: string,
    records: SaveAttendanceRecordData[],
  ) => Promise<SaveAttendanceRecordsDatabaseResult>;
};

export class AttendanceSessionConflictError extends Error {
  constructor() {
    super("The class already has a session on this date.");
    this.name = "AttendanceSessionConflictError";
  }
}

class AttendanceRosterMismatchError extends Error {
  constructor() {
    super("The submitted roster does not match the current class enrollment.");
    this.name = "AttendanceRosterMismatchError";
  }
}

const attendanceStudentSelect = {
  id: true,
  studentNo: true,
  firstName: true,
  lastName: true,
} as const;

const attendanceSessionSelect = {
  id: true,
  classId: true,
  classScheduleId: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  rosterInitializedAt: true,
  attendanceRecords: {
    select: {
      id: true,
      studentId: true,
      status: true,
      remarks: true,
      student: { select: attendanceStudentSelect },
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
        select: {
          student: { select: attendanceStudentSelect },
        },
        orderBy: [
          { student: { lastName: "asc" } },
          { student: { firstName: "asc" } },
          { studentId: "asc" },
        ],
      },
    },
  },
} satisfies Prisma.AttendanceSessionSelect;

// Recognizes only the class/date unique constraint used for concurrent manual creates.
function isAttendanceSessionUniqueConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  return (
    target === "AttendanceSession_classId_sessionDate_key" ||
    (Array.isArray(target) &&
      target.includes("classId") &&
      target.includes("sessionDate"))
  );
}

// Resolves Monday=1 through Sunday=7 without browser or server local-time conversion.
export function getIsoWeekday(sessionDate: string) {
  const utcWeekday = new Date(`${sessionDate}T00:00:00.000Z`).getUTCDay();
  return utcWeekday === 0 ? 7 : utcWeekday;
}

// Converts a validated calendar date to Prisma's date-only transport value.
function toDatabaseDate(sessionDate: string) {
  return new Date(`${sessionDate}T00:00:00.000Z`);
}

// Converts a PostgreSQL date value to the stable YYYY-MM-DD API representation.
function toDateOnly(sessionDate: Date) {
  return sessionDate.toISOString().slice(0, 10);
}

// Returns stable inclusive/exclusive Date values for one validated calendar month.
function getAttendanceMonthBounds(year: number, month: number) {
  return {
    monthStart: new Date(Date.UTC(year, month - 1, 1)),
    nextMonthStart: new Date(Date.UTC(year, month, 1)),
  };
}

// Produces scheduled session snapshots inside the requested month and class date range.
export function buildScheduledAttendanceSessions(
  classId: string,
  year: number,
  month: number,
  classSnapshot: AttendanceClassMonthSnapshot,
): CreateAttendanceSessionData[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = classSnapshot.startDate
    ? toDateOnly(classSnapshot.startDate)
    : null;
  const endDate = classSnapshot.endDate
    ? toDateOnly(classSnapshot.endDate)
    : null;
  const schedulesByWeekday = new Map(
    classSnapshot.classSchedules.map((schedule) => [schedule.dayOfWeek, schedule]),
  );
  const sessions: CreateAttendanceSessionData[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const sessionDate = [
      year.toString().padStart(4, "0"),
      month.toString().padStart(2, "0"),
      day.toString().padStart(2, "0"),
    ].join("-");

    if (
      (startDate !== null && sessionDate < startDate) ||
      (endDate !== null && sessionDate > endDate)
    ) {
      continue;
    }

    const schedule = schedulesByWeekday.get(getIsoWeekday(sessionDate));
    if (!schedule) {
      continue;
    }

    sessions.push({
      classId,
      classScheduleId: schedule.id,
      sessionDate: toDatabaseDate(sessionDate),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });
  }

  return sessions;
}

// Compares complete student sets without relying on request ordering.
function hasExactStudentSet(storedStudentIds: string[], submittedStudentIds: string[]) {
  if (storedStudentIds.length !== submittedStudentIds.length) {
    return false;
  }

  const storedStudentIdSet = new Set(storedStudentIds);
  return submittedStudentIds.every((studentId) => storedStudentIdSet.has(studentId));
}

const defaultDependencies: AttendanceServiceDependencies = {
  // Loads only active-state and weekly schedule data needed for one manual date.
  findClassSnapshot: (classId) =>
    prisma.class.findUnique({
      where: { id: classId },
      select: {
        archivedAt: true,
        classSchedules: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
          orderBy: { dayOfWeek: "asc" },
        },
      },
    }),
  // Creates only the manual session; current enrollments remain a response-only draft.
  insertSession: async (data) => {
    try {
      return await prisma.attendanceSession.create({
        data,
        select: attendanceSessionSelect,
      });
    } catch (error) {
      if (isAttendanceSessionUniqueConflict(error)) {
        throw new AttendanceSessionConflictError();
      }

      throw error;
    }
  },
  // Confirms archived and active classes alike for historical session listing.
  classExists: async (classId) => {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    return classRecord !== null;
  },
  // Returns at most 31 newest sessions with only the complete public roster selection.
  findClassSessions: (classId) =>
    prisma.attendanceSession.findMany({
      where: { classId },
      take: 31,
      orderBy: [{ sessionDate: "desc" }, { id: "asc" }],
      select: attendanceSessionSelect,
    }),
  // Loads one complete safe session source record by identifier.
  findSession: (sessionId) =>
    prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: attendanceSessionSelect,
    }),
  // Deletes the session and relies on the database cascade for its roster records.
  deleteSession: async (sessionId) => {
    const result = await prisma.attendanceSession.deleteMany({
      where: { id: sessionId },
    });
    return result.count === 1;
  },
  // Serializes one class/month, creates missing sessions, then marks the month in one transaction.
  ensureSessionMonth: (classId, year, month) =>
    prisma.$transaction(async (transaction) => {
      const monthLockKey = `${classId}:${year}-${month.toString().padStart(2, "0")}`;
      await transaction.$queryRaw<Array<{ locked: number }>>`
        SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${monthLockKey}))
      `;

      const classSnapshot = await transaction.class.findUnique({
        where: { id: classId },
        select: {
          archivedAt: true,
          startDate: true,
          endDate: true,
          classSchedules: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
            },
            orderBy: { dayOfWeek: "asc" },
          },
        },
      });

      if (!classSnapshot) {
        return { status: "class_not_found" };
      }

      if (classSnapshot.archivedAt !== null) {
        return { status: "class_archived" };
      }

      const { monthStart, nextMonthStart } = getAttendanceMonthBounds(year, month);
      const generation = await transaction.attendanceMonthGeneration.findUnique({
        where: {
          classId_monthStart: { classId, monthStart },
        },
        select: { id: true },
      });

      if (!generation) {
        const sessions = buildScheduledAttendanceSessions(
          classId,
          year,
          month,
          classSnapshot,
        );

        if (sessions.length > 0) {
          await transaction.attendanceSession.createMany({
            data: sessions,
            skipDuplicates: true,
          });
        }

        await transaction.attendanceMonthGeneration.create({
          data: { classId, monthStart },
          select: { id: true },
        });
      }

      const sessions = await transaction.attendanceSession.findMany({
        where: {
          classId,
          sessionDate: { gte: monthStart, lt: nextMonthStart },
        },
        take: 31,
        orderBy: [{ sessionDate: "desc" }, { id: "asc" }],
        select: attendanceSessionSelect,
      });

      return { status: "ensured", sessions };
    }),
  // Claims first initialization before reading enrollments so roster creation and values are atomic.
  saveSessionRecords: async (sessionId, records) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        const session = await transaction.attendanceSession.findUnique({
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
          const claimed = await transaction.attendanceSession.updateMany({
            where: { id: sessionId, rosterInitializedAt: null },
            data: { rosterInitializedAt: new Date() },
          });
          isInitializing = claimed.count === 1;
        }

        const submittedStudentIds = records.map((record) => record.studentId);
        if (isInitializing) {
          const enrollments = await transaction.studentEnrollment.findMany({
            where: { classId: session.classId },
            select: { studentId: true },
            orderBy: { studentId: "asc" },
          });
          const currentStudentIds = enrollments.map((enrollment) => enrollment.studentId);

          if (!hasExactStudentSet(currentStudentIds, submittedStudentIds)) {
            throw new AttendanceRosterMismatchError();
          }

          if (records.length > 0) {
            await transaction.attendanceRecord.createMany({
              data: records.map((record) => ({
                sessionId,
                studentId: record.studentId,
                status: record.status,
                remarks: record.remarks,
              })),
            });
          }
        } else {
          const storedSession = await transaction.attendanceSession.findUnique({
            where: { id: sessionId },
            select: {
              attendanceRecords: {
                select: { studentId: true },
                orderBy: { studentId: "asc" },
              },
            },
          });

          if (!storedSession) {
            return { status: "session_not_found" };
          }

          const storedStudentIds = storedSession.attendanceRecords.map(
            (record) => record.studentId,
          );
          if (!hasExactStudentSet(storedStudentIds, submittedStudentIds)) {
            return { status: "roster_mismatch" };
          }

          for (const record of records) {
            await transaction.attendanceRecord.update({
              where: {
                sessionId_studentId: {
                  sessionId,
                  studentId: record.studentId,
                },
              },
              data: {
                status: record.status,
                remarks: record.remarks,
              },
            });
          }
        }

        const savedSession = await transaction.attendanceSession.findUnique({
          where: { id: sessionId },
          select: attendanceSessionSelect,
        });

        return savedSession
          ? { status: "saved", session: savedSession }
          : { status: "session_not_found" };
      });
    } catch (error) {
      if (error instanceof AttendanceRosterMismatchError) {
        return { status: "roster_mismatch" };
      }

      throw error;
    }
  },
};

// Maps stored Prisma enum values to the four public PALE codes.
export function toPaleAttendanceStatus(
  status: AttendanceStatus | null,
): AttendanceStatusCode | null {
  switch (status) {
    case AttendanceStatus.PRESENT:
      return "P";
    case AttendanceStatus.ABSENT:
      return "A";
    case AttendanceStatus.LATE:
      return "L";
    case AttendanceStatus.EXCUSED:
      return "E";
    case null:
      return null;
  }
}

// Maps untrusted-boundary PALE codes explicitly into Prisma enum values.
export function toDatabaseAttendanceStatus(
  status: AttendanceStatusCode | null,
): AttendanceStatus | null {
  switch (status) {
    case "P":
      return AttendanceStatus.PRESENT;
    case "A":
      return AttendanceStatus.ABSENT;
    case "L":
      return AttendanceStatus.LATE;
    case "E":
      return AttendanceStatus.EXCUSED;
    case null:
      return null;
  }
}

// Maps persisted records or current-enrollment drafts to one safe public session.
function toAttendanceSessionRecord(
  session: AttendanceSessionDatabaseRecord,
): AttendanceSessionRecord {
  const isRosterInitialized = session.rosterInitializedAt !== null;
  const records = isRosterInitialized
    ? session.attendanceRecords.map((record) => ({
      id: record.id,
      student: {
        id: record.student.id,
        studentNo: record.student.studentNo,
        firstName: record.student.firstName,
        lastName: record.student.lastName,
      },
      status: toPaleAttendanceStatus(record.status),
      remarks: record.remarks,
    }))
    : session.class.enrollments.map((enrollment) => ({
      id: null,
      student: {
        id: enrollment.student.id,
        studentNo: enrollment.student.studentNo,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
      },
      status: null,
      remarks: null,
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
    classScheduleId: session.classScheduleId,
    sessionDate: toDateOnly(session.sessionDate),
    startTime: session.startTime,
    endTime: session.endTime,
    isRosterInitialized,
    records,
  };
}

export type CreateAttendanceSessionResult =
  | { status: "created"; session: AttendanceSessionRecord }
  | { status: "class_not_found" }
  | { status: "class_archived" }
  | { status: "session_exists" };

// Creates one manual date-only session and returns current enrollments as an unsaved draft.
export async function createAttendanceSession(
  classId: string,
  sessionDate: string,
  dependencies: AttendanceServiceDependencies = defaultDependencies,
): Promise<CreateAttendanceSessionResult> {
  const classSnapshot = await dependencies.findClassSnapshot(classId);

  if (!classSnapshot) {
    return { status: "class_not_found" };
  }

  if (classSnapshot.archivedAt !== null) {
    return { status: "class_archived" };
  }

  const weekday = getIsoWeekday(sessionDate);
  const matchingSchedule = classSnapshot.classSchedules.find(
    (schedule) => schedule.dayOfWeek === weekday,
  );

  try {
    const session = await dependencies.insertSession({
      classId,
      classScheduleId: matchingSchedule?.id ?? null,
      sessionDate: toDatabaseDate(sessionDate),
      startTime: matchingSchedule?.startTime ?? null,
      endTime: matchingSchedule?.endTime ?? null,
    });

    return { status: "created", session: toAttendanceSessionRecord(session) };
  } catch (error) {
    if (error instanceof AttendanceSessionConflictError) {
      return { status: "session_exists" };
    }

    throw error;
  }
}

export type EnsureAttendanceMonthResult =
  | { status: "ensured"; sessions: AttendanceSessionRecord[] }
  | { status: "class_not_found" }
  | { status: "class_archived" };

// Ensures one active class/month exactly once and returns every session in that month.
export async function ensureAttendanceMonth(
  classId: string,
  year: number,
  month: number,
  dependencies: AttendanceServiceDependencies = defaultDependencies,
): Promise<EnsureAttendanceMonthResult> {
  const result = await dependencies.ensureSessionMonth(classId, year, month);
  return result.status === "ensured"
    ? {
      status: "ensured",
      sessions: result.sessions.map(toAttendanceSessionRecord),
    }
    : result;
}

export type ListAttendanceSessionsResult =
  | { status: "found"; sessions: AttendanceSessionRecord[] }
  | { status: "class_not_found" };

// Loads the bounded newest-first Attendance matrix for an existing class.
export async function listAttendanceSessions(
  classId: string,
  dependencies: AttendanceServiceDependencies = defaultDependencies,
): Promise<ListAttendanceSessionsResult> {
  if (!(await dependencies.classExists(classId))) {
    return { status: "class_not_found" };
  }

  const sessions = await dependencies.findClassSessions(classId);
  return {
    status: "found",
    sessions: sessions.map(toAttendanceSessionRecord),
  };
}

// Loads one session with either its saved history or a current-enrollment draft roster.
export async function loadAttendanceSession(
  sessionId: string,
  dependencies: AttendanceServiceDependencies = defaultDependencies,
) {
  const session = await dependencies.findSession(sessionId);
  return session ? toAttendanceSessionRecord(session) : null;
}

// Removes one complete persisted date and its cascading Attendance records.
export function deleteAttendanceSession(
  sessionId: string,
  dependencies: AttendanceServiceDependencies = defaultDependencies,
) {
  return dependencies.deleteSession(sessionId);
}

export type SaveAttendanceRecordsResult =
  | { status: "saved"; session: AttendanceSessionRecord }
  | { status: "session_not_found" }
  | { status: "student_duplicate" }
  | { status: "roster_mismatch" };

// Initializes the current roster on first save or updates only the stored historical roster.
export async function saveAttendanceRecords(
  sessionId: string,
  records: AttendanceRecordInput[],
  dependencies: AttendanceServiceDependencies = defaultDependencies,
): Promise<SaveAttendanceRecordsResult> {
  const submittedStudentIds = records.map((record) => record.studentId);
  if (new Set(submittedStudentIds).size !== submittedStudentIds.length) {
    return { status: "student_duplicate" };
  }

  const result = await dependencies.saveSessionRecords(
    sessionId,
    records.map((record) => ({
      studentId: record.studentId,
      status: toDatabaseAttendanceStatus(record.status),
      remarks: record.remarks,
    })),
  );

  return result.status === "saved"
    ? { status: "saved", session: toAttendanceSessionRecord(result.session) }
    : result;
}
