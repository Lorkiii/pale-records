// Owns Attendance date matching, roster snapshots, status mapping, and atomic persistence.
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

type AttendanceDatabaseRecord = {
  id: string;
  studentId: string;
  status: AttendanceStatus | null;
  remarks: string | null;
  student: {
    id: string;
    studentNo: string | null;
    firstName: string;
    lastName: string;
  };
};

type AttendanceSessionDatabaseRecord = {
  id: string;
  classId: string;
  classScheduleId: string | null;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
  attendanceRecords: AttendanceDatabaseRecord[];
};

type AttendanceClassSnapshot = {
  archivedAt: Date | null;
  classSchedules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  enrollments: Array<{ studentId: string }>;
};

type CreateAttendanceSessionData = {
  classId: string;
  classScheduleId: string | null;
  sessionDate: Date;
  startTime: string | null;
  endTime: string | null;
  studentIds: string[];
};

type SaveAttendanceRecordData = {
  studentId: string;
  status: AttendanceStatus | null;
  remarks: string | null;
};

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
  findSessionRoster: (sessionId: string) => Promise<string[] | null>;
  updateSessionRecords: (
    sessionId: string,
    records: SaveAttendanceRecordData[],
  ) => Promise<AttendanceSessionDatabaseRecord | null>;
};

export class AttendanceSessionConflictError extends Error {
  constructor() {
    super("The class already has a session on this date.");
    this.name = "AttendanceSessionConflictError";
  }
}

const attendanceSessionSelect = {
  id: true,
  classId: true,
  classScheduleId: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  attendanceRecords: {
    select: {
      id: true,
      studentId: true,
      status: true,
      remarks: true,
      student: {
        select: {
          id: true,
          studentNo: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
      { studentId: "asc" },
    ],
  },
} satisfies Prisma.AttendanceSessionSelect;

// Recognizes only the class/date unique constraint used for concurrent creates.
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

const defaultDependencies: AttendanceServiceDependencies = {
  // Loads active-state, weekly schedule, and current enrollment data needed for one snapshot.
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
        enrollments: {
          select: { studentId: true },
          orderBy: { studentId: "asc" },
        },
      },
    }),
  // Creates the session and every unmarked roster row in one database transaction.
  insertSession: async (data) => {
    try {
      return await prisma.$transaction((transaction) =>
        transaction.attendanceSession.create({
          data: {
            classId: data.classId,
            classScheduleId: data.classScheduleId,
            sessionDate: data.sessionDate,
            startTime: data.startTime,
            endTime: data.endTime,
            attendanceRecords: {
              create: data.studentIds.map((studentId) => ({
                studentId,
                status: null,
                remarks: null,
              })),
            },
          },
          select: attendanceSessionSelect,
        }),
      );
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
  // Reads only the persisted student identifiers needed for exact roster comparison.
  findSessionRoster: async (sessionId) => {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: {
        attendanceRecords: {
          select: { studentId: true },
          orderBy: { studentId: "asc" },
        },
      },
    });
    return session?.attendanceRecords.map((record) => record.studentId) ?? null;
  },
  // Updates the complete validated roster and reloads its public shape atomically.
  updateSessionRecords: (sessionId, records) =>
    prisma.$transaction(async (transaction) => {
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

      return transaction.attendanceSession.findUnique({
        where: { id: sessionId },
        select: attendanceSessionSelect,
      });
    }),
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

// Resolves Monday=1 through Sunday=7 without browser or server local-time conversion.
export function getIsoWeekday(sessionDate: string) {
  const utcWeekday = new Date(`${sessionDate}T00:00:00.000Z`).getUTCDay();
  return utcWeekday === 0 ? 7 : utcWeekday;
}

// Converts the validated calendar date to Prisma's date-only transport value.
function toDatabaseDate(sessionDate: string) {
  return new Date(`${sessionDate}T00:00:00.000Z`);
}

// Converts a PostgreSQL date value to the stable YYYY-MM-DD API representation.
function toDateOnly(sessionDate: Date) {
  return sessionDate.toISOString().slice(0, 10);
}

// Maps internal relations and enum values to the safe public Attendance session.
function toAttendanceSessionRecord(
  session: AttendanceSessionDatabaseRecord,
): AttendanceSessionRecord {
  const records = session.attendanceRecords
    .map((record) => ({
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
    .sort(
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
    records,
  };
}

export type CreateAttendanceSessionResult =
  | { status: "created"; session: AttendanceSessionRecord }
  | { status: "class_not_found" }
  | { status: "class_archived" }
  | { status: "class_has_no_students" }
  | { status: "session_exists" };

// Matches one date to its weekly schedule and snapshots the current enrolled roster.
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

  if (classSnapshot.enrollments.length === 0) {
    return { status: "class_has_no_students" };
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
      studentIds: classSnapshot.enrollments.map((enrollment) => enrollment.studentId),
    });

    return { status: "created", session: toAttendanceSessionRecord(session) };
  } catch (error) {
    if (error instanceof AttendanceSessionConflictError) {
      return { status: "session_exists" };
    }

    throw error;
  }
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

// Loads one persisted session and its immutable roster snapshot.
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

// Requires an exact submitted student set before atomically replacing every saved record.
export async function saveAttendanceRecords(
  sessionId: string,
  records: AttendanceRecordInput[],
  dependencies: AttendanceServiceDependencies = defaultDependencies,
): Promise<SaveAttendanceRecordsResult> {
  const submittedStudentIds = records.map((record) => record.studentId);
  if (new Set(submittedStudentIds).size !== submittedStudentIds.length) {
    return { status: "student_duplicate" };
  }

  const storedStudentIds = await dependencies.findSessionRoster(sessionId);
  if (!storedStudentIds) {
    return { status: "session_not_found" };
  }

  const storedStudentIdSet = new Set(storedStudentIds);
  if (
    storedStudentIds.length !== submittedStudentIds.length ||
    submittedStudentIds.some((studentId) => !storedStudentIdSet.has(studentId))
  ) {
    return { status: "roster_mismatch" };
  }

  const savedSession = await dependencies.updateSessionRecords(
    sessionId,
    records.map((record) => ({
      studentId: record.studentId,
      status: toDatabaseAttendanceStatus(record.status),
      remarks: record.remarks,
    })),
  );

  return savedSession
    ? { status: "saved", session: toAttendanceSessionRecord(savedSession) }
    : { status: "session_not_found" };
}
