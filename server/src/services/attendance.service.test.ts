// Verifies monthly Attendance generation, deferred drafts, and immutable historical roster saves.
import assert from "node:assert/strict";
import test from "node:test";

import { AttendanceStatus } from "../generated/prisma/client.js";
import {
  AttendanceSessionConflictError,
  buildScheduledAttendanceSessions,
  createAttendanceSession,
  deleteAttendanceSession,
  ensureAttendanceMonth,
  getIsoWeekday,
  listAttendanceSessions,
  loadAttendanceSession,
  saveAttendanceRecords,
  type AttendanceServiceDependencies,
  toDatabaseAttendanceStatus,
  toPaleAttendanceStatus,
} from "./attendance.service.js";

const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const scheduleId = "1b4a1b8f-2a16-4a83-98a3-3e772df4f700";
const sessionId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const firstStudentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const secondStudentId = "1d7f6a68-01d8-4abe-9f17-c3d03ed4ad86";
const extraStudentId = "e1003b44-b8b0-47eb-bdc3-cb6936ce0f4c";

const firstStudent = {
  id: firstStudentId,
  studentNo: "AB-123",
  firstName: "Ana",
  lastName: "Reyes",
};

const secondStudent = {
  id: secondStudentId,
  studentNo: null,
  firstName: "Ben",
  lastName: "Cruz",
};

const extraStudent = {
  id: extraStudentId,
  studentNo: "AB-125",
  firstName: "Cara",
  lastName: "Diaz",
};

const currentEnrollments = [firstStudent, secondStudent].map((student) => ({ student }));

const storedSession = {
  id: sessionId,
  classId,
  classScheduleId: scheduleId,
  sessionDate: new Date("2026-08-25T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "11:00",
  rosterInitializedAt: new Date("2026-08-25T12:00:00.000Z"),
  attendanceRecords: [
    {
      id: "6fd5133c-0985-49a2-b3dc-10a3b03110de",
      studentId: firstStudentId,
      student: firstStudent,
      status: AttendanceStatus.PRESENT,
      remarks: null,
    },
    {
      id: "e7d59d7b-ae0c-49ae-8512-3f9fcdb457ae",
      studentId: secondStudentId,
      student: secondStudent,
      status: AttendanceStatus.EXCUSED,
      remarks: "Medical appointment",
    },
  ],
  class: { enrollments: currentEnrollments },
};

const draftSession = {
  ...storedSession,
  rosterInitializedAt: null,
  attendanceRecords: [],
};

const activeClassSnapshot = {
  archivedAt: null,
  classSchedules: [{
    id: scheduleId,
    dayOfWeek: 2,
    startTime: "09:00",
    endTime: "11:00",
  }],
};

// Creates deterministic service fakes while allowing one behavior to vary per test.
function createDependencies(
  overrides: Partial<AttendanceServiceDependencies> = {},
): AttendanceServiceDependencies {
  return {
    findClassSnapshot: async () => activeClassSnapshot,
    insertSession: async () => draftSession,
    classExists: async () => true,
    findClassSessions: async () => [],
    findSession: async () => storedSession,
    deleteSession: async () => true,
    ensureSessionMonth: async () => ({ status: "ensured", sessions: [] }),
    saveSessionRecords: async () => ({ status: "saved", session: storedSession }),
    ...overrides,
  };
}

test("buildScheduledAttendanceSessions generates every matching weekday in a month", () => {
  const rows = buildScheduledAttendanceSessions(classId, 2026, 8, {
    ...activeClassSnapshot,
    startDate: null,
    endDate: null,
  });

  assert.equal(getIsoWeekday("2026-08-25"), 2);
  assert.deepEqual(
    rows.map((row) => row.sessionDate.toISOString().slice(0, 10)),
    ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"],
  );
  assert.deepEqual(rows[0], {
    classId,
    classScheduleId: scheduleId,
    sessionDate: new Date("2026-08-04T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "11:00",
  });
});

test("monthly generation respects inclusive class start and end dates", () => {
  const rows = buildScheduledAttendanceSessions(classId, 2026, 8, {
    ...activeClassSnapshot,
    startDate: new Date("2026-08-10T00:00:00.000Z"),
    endDate: new Date("2026-08-18T00:00:00.000Z"),
  });

  assert.deepEqual(
    rows.map((row) => row.sessionDate.toISOString().slice(0, 10)),
    ["2026-08-11", "2026-08-18"],
  );
});

test("ensureAttendanceMonth preserves archived and missing class outcomes", async () => {
  let archivedCalls = 0;
  const archived = await ensureAttendanceMonth(classId, 2026, 8, createDependencies({
    ensureSessionMonth: async () => {
      archivedCalls += 1;
      return { status: "class_archived" };
    },
  }));
  const missing = await ensureAttendanceMonth(classId, 2026, 8, createDependencies({
    ensureSessionMonth: async () => ({ status: "class_not_found" }),
  }));

  assert.equal(archivedCalls, 1);
  assert.deepEqual(archived, { status: "class_archived" });
  assert.deepEqual(missing, { status: "class_not_found" });
});

test("repeated and concurrent month opens skip manual dates and do not recreate deletions", async () => {
  const manualSession = {
    ...draftSession,
    id: "00000000-0000-4000-8000-000000000011",
    classScheduleId: null,
    sessionDate: new Date("2026-08-11T00:00:00.000Z"),
    startTime: null,
    endTime: null,
  };
  type TestAttendanceSession = NonNullable<
    Awaited<ReturnType<AttendanceServiceDependencies["findSession"]>>
  >;
  let sessions: TestAttendanceSession[] = [manualSession];
  let isGenerated = false;
  let generationPasses = 0;

  const dependencies = createDependencies({
    ensureSessionMonth: async () => {
      if (!isGenerated) {
        isGenerated = true;
        generationPasses += 1;
        const rows = buildScheduledAttendanceSessions(classId, 2026, 8, {
          ...activeClassSnapshot,
          startDate: null,
          endDate: null,
        });

        for (const row of rows) {
          const date = row.sessionDate.toISOString().slice(0, 10);
          if (sessions.some((session) => session.sessionDate.getTime() === row.sessionDate.getTime())) {
            continue;
          }
          sessions.push({
            ...draftSession,
            id: `00000000-0000-4000-8000-${date.slice(-2).padStart(12, "0")}`,
            classScheduleId: row.classScheduleId,
            sessionDate: row.sessionDate,
            startTime: row.startTime,
            endTime: row.endTime,
          });
        }
      }

      return { status: "ensured", sessions };
    },
  });

  const [first, concurrentRetry] = await Promise.all([
    ensureAttendanceMonth(classId, 2026, 8, dependencies),
    ensureAttendanceMonth(classId, 2026, 8, dependencies),
  ]);

  assert.equal(generationPasses, 1);
  assert.equal(first.status, "ensured");
  assert.equal(concurrentRetry.status, "ensured");
  if (first.status === "ensured") {
    assert.equal(first.sessions.length, 4);
    assert.equal(first.sessions.filter((session) => session.sessionDate === "2026-08-11").length, 1);
    assert.equal(first.sessions.every((session) => !session.isRosterInitialized), true);
    assert.equal(sessions.every((session) => session.attendanceRecords.length === 0), true);
  }

  sessions = sessions.filter(
    (session) => session.sessionDate.toISOString().slice(0, 10) !== "2026-08-18",
  );
  const reopened = await ensureAttendanceMonth(classId, 2026, 8, dependencies);

  assert.equal(generationPasses, 1);
  assert.equal(
    reopened.status === "ensured" &&
      reopened.sessions.some((session) => session.sessionDate === "2026-08-18"),
    false,
  );
});

test("manual creation keeps past unscheduled dates and creates no AttendanceRecord rows", async () => {
  let receivedData:
    | Parameters<AttendanceServiceDependencies["insertSession"]>[0]
    | undefined;
  const result = await createAttendanceSession(
    classId,
    "2026-07-01",
    createDependencies({
      insertSession: async (data) => {
        receivedData = data;
        return {
          ...draftSession,
          classScheduleId: data.classScheduleId,
          sessionDate: data.sessionDate,
          startTime: data.startTime,
          endTime: data.endTime,
        };
      },
    }),
  );

  assert.deepEqual(receivedData, {
    classId,
    classScheduleId: null,
    sessionDate: new Date("2026-07-01T00:00:00.000Z"),
    startTime: null,
    endTime: null,
  });
  assert.equal(result.status, "created");
  if (result.status === "created") {
    assert.equal(result.session.isRosterInitialized, false);
    assert.equal(result.session.records.every((record) => record.id === null), true);
  }
});

test("manual creation still reports archived, missing, and duplicate dates", async () => {
  const missing = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    findClassSnapshot: async () => null,
  }));
  const archived = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    findClassSnapshot: async () => ({
      ...activeClassSnapshot,
      archivedAt: new Date("2026-08-24T00:00:00.000Z"),
    }),
  }));
  const duplicate = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    insertSession: async () => {
      throw new AttendanceSessionConflictError();
    },
  }));

  assert.deepEqual(missing, { status: "class_not_found" });
  assert.deepEqual(archived, { status: "class_archived" });
  assert.deepEqual(duplicate, { status: "session_exists" });
});

test("loading an uninitialized session returns a current Unmarked draft without persistence", async () => {
  const source = {
    ...draftSession,
    attendanceRecords: [] as typeof storedSession.attendanceRecords,
  };
  const loaded = await loadAttendanceSession(sessionId, createDependencies({
    findSession: async () => source,
  }));

  assert.equal(source.attendanceRecords.length, 0);
  assert.equal(loaded?.isRosterInitialized, false);
  assert.deepEqual(loaded?.records.map((record) => ({
    id: record.id,
    studentId: record.student.id,
    status: record.status,
    remarks: record.remarks,
  })), [
    { id: null, studentId: secondStudentId, status: null, remarks: null },
    { id: null, studentId: firstStudentId, status: null, remarks: null },
  ]);
  assert.equal(source.attendanceRecords.length, 0);
});

test("first save submits one complete mapped roster operation and returns saved history", async () => {
  let saveCalls = 0;
  let receivedRecords:
    | Parameters<AttendanceServiceDependencies["saveSessionRecords"]>[1]
    | undefined;
  const result = await saveAttendanceRecords(
    sessionId,
    [
      { studentId: firstStudentId, status: "L", remarks: null },
      { studentId: secondStudentId, status: "E", remarks: "Medical appointment" },
    ],
    createDependencies({
      saveSessionRecords: async (_receivedSessionId, records) => {
        saveCalls += 1;
        receivedRecords = records;
        return { status: "saved", session: storedSession };
      },
    }),
  );

  assert.equal(saveCalls, 1);
  assert.deepEqual(receivedRecords, [
    { studentId: firstStudentId, status: AttendanceStatus.LATE, remarks: null },
    {
      studentId: secondStudentId,
      status: AttendanceStatus.EXCUSED,
      remarks: "Medical appointment",
    },
  ]);
  assert.equal(result.status, "saved");
  if (result.status === "saved") {
    assert.equal(result.session.isRosterInitialized, true);
    assert.equal(result.session.records.every((record) => record.id !== null), true);
  }
});

test("enrollment changes affect unsaved sessions but not saved historical rosters", async () => {
  const enrollmentState = [...currentEnrollments];
  const unsaved = {
    ...draftSession,
    class: { enrollments: enrollmentState },
  };
  const saved = {
    ...storedSession,
    class: { enrollments: enrollmentState },
  };

  enrollmentState.push({ student: extraStudent });
  const unsavedLoaded = await loadAttendanceSession(sessionId, createDependencies({
    findSession: async () => unsaved,
  }));
  const savedLoaded = await loadAttendanceSession(sessionId, createDependencies({
    findSession: async () => saved,
  }));

  assert.deepEqual(
    unsavedLoaded?.records.map((record) => record.student.id).sort(),
    [firstStudentId, secondStudentId, extraStudentId].sort(),
  );
  assert.deepEqual(
    savedLoaded?.records.map((record) => record.student.id).sort(),
    [firstStudentId, secondStudentId].sort(),
  );
});

test("save rejects duplicate and database-reported roster mismatches", async () => {
  let saveWasCalled = false;
  const duplicate = await saveAttendanceRecords(sessionId, [
    { studentId: firstStudentId, status: "P", remarks: null },
    { studentId: firstStudentId, status: "A", remarks: null },
  ], createDependencies({
    saveSessionRecords: async () => {
      saveWasCalled = true;
      return { status: "saved", session: storedSession };
    },
  }));
  const mismatch = await saveAttendanceRecords(sessionId, [
    { studentId: firstStudentId, status: "P", remarks: null },
  ], createDependencies({
    saveSessionRecords: async () => ({ status: "roster_mismatch" }),
  }));

  assert.deepEqual(duplicate, { status: "student_duplicate" });
  assert.equal(saveWasCalled, false);
  assert.deepEqual(mismatch, { status: "roster_mismatch" });
});

test("list, delete, and Attendance status mapping preserve safe existing behavior", async () => {
  const internalSession = { ...storedSession, internalValue: "not public" };
  const listResult = await listAttendanceSessions(classId, createDependencies({
    findClassSessions: async () => [internalSession],
  }));
  const deleted = await deleteAttendanceSession(sessionId, createDependencies());

  assert.equal(listResult.status, "found");
  if (listResult.status === "found") {
    assert.equal(listResult.sessions[0]?.sessionDate, "2026-08-25");
    assert.equal(Object.hasOwn(listResult.sessions[0] ?? {}, "internalValue"), false);
  }
  assert.equal(deleted, true);

  const pairs = [
    ["P", AttendanceStatus.PRESENT],
    ["A", AttendanceStatus.ABSENT],
    ["L", AttendanceStatus.LATE],
    ["E", AttendanceStatus.EXCUSED],
    [null, null],
  ] as const;
  for (const [code, databaseStatus] of pairs) {
    assert.equal(toDatabaseAttendanceStatus(code), databaseStatus);
    assert.equal(toPaleAttendanceStatus(databaseStatus), code);
  }
});
