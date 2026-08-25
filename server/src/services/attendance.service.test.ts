// Verifies Attendance scheduling, snapshots, mappings, conflicts, and exact-roster saves without a live database.
import assert from "node:assert/strict";
import test from "node:test";

import { AttendanceStatus } from "../generated/prisma/client.js";
import {
  AttendanceSessionConflictError,
  createAttendanceSession,
  deleteAttendanceSession,
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

const storedSession = {
  id: sessionId,
  classId,
  classScheduleId: scheduleId,
  sessionDate: new Date("2026-08-25T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "11:00",
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
};

const activeClassSnapshot = {
  archivedAt: null,
  classSchedules: [{
    id: scheduleId,
    dayOfWeek: 2,
    startTime: "09:00",
    endTime: "11:00",
  }],
  enrollments: [
    { studentId: firstStudentId },
    { studentId: secondStudentId },
  ],
};

// Creates deterministic service fakes while allowing one behavior to vary per test.
function createDependencies(
  overrides: Partial<AttendanceServiceDependencies> = {},
): AttendanceServiceDependencies {
  return {
    findClassSnapshot: async () => activeClassSnapshot,
    insertSession: async () => storedSession,
    classExists: async () => true,
    findClassSessions: async () => [],
    findSession: async () => storedSession,
    deleteSession: async () => true,
    findSessionRoster: async () => [firstStudentId, secondStudentId],
    updateSessionRecords: async () => storedSession,
    ...overrides,
  };
}

test("createAttendanceSession snapshots a matching schedule and every enrollment", async () => {
  let receivedData:
    | Parameters<AttendanceServiceDependencies["insertSession"]>[0]
    | undefined;
  const result = await createAttendanceSession(
    classId,
    "2026-08-25",
    createDependencies({
      insertSession: async (data) => {
        receivedData = data;
        return storedSession;
      },
    }),
  );

  assert.equal(getIsoWeekday("2026-08-25"), 2);
  assert.equal(result.status, "created");
  assert.deepEqual(receivedData, {
    classId,
    classScheduleId: scheduleId,
    sessionDate: new Date("2026-08-25T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "11:00",
    studentIds: [firstStudentId, secondStudentId],
  });
});

test("createAttendanceSession allows an Unscheduled calendar date", async () => {
  let receivedData:
    | Parameters<AttendanceServiceDependencies["insertSession"]>[0]
    | undefined;
  await createAttendanceSession(
    classId,
    "2026-08-26",
    createDependencies({
      insertSession: async (data) => {
        receivedData = data;
        return {
          ...storedSession,
          classScheduleId: null,
          sessionDate: data.sessionDate,
          startTime: null,
          endTime: null,
        };
      },
    }),
  );

  assert.equal(receivedData?.classScheduleId, null);
  assert.equal(receivedData?.startTime, null);
  assert.equal(receivedData?.endTime, null);
});

test("createAttendanceSession rejects missing, archived, and empty-roster classes", async () => {
  const missing = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    findClassSnapshot: async () => null,
  }));
  const archived = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    findClassSnapshot: async () => ({
      ...activeClassSnapshot,
      archivedAt: new Date("2026-08-24T00:00:00.000Z"),
    }),
  }));
  const empty = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    findClassSnapshot: async () => ({
      ...activeClassSnapshot,
      enrollments: [],
    }),
  }));

  assert.deepEqual(missing, { status: "class_not_found" });
  assert.deepEqual(archived, { status: "class_archived" });
  assert.deepEqual(empty, { status: "class_has_no_students" });
});

test("createAttendanceSession reports the expected class/date uniqueness conflict", async () => {
  const result = await createAttendanceSession(classId, "2026-08-25", createDependencies({
    insertSession: async () => {
      throw new AttendanceSessionConflictError();
    },
  }));

  assert.deepEqual(result, { status: "session_exists" });
});

test("Attendance status mapping is explicit in both directions", () => {
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

test("listAttendanceSessions returns newest source records as stable safe dates", async () => {
  const internalSession = { ...storedSession, internalValue: "not public" };
  const result = await listAttendanceSessions(classId, createDependencies({
    findClassSessions: async () => [internalSession],
  }));

  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.sessions[0]?.sessionDate, "2026-08-25");
    assert.equal(result.sessions[0]?.records[0]?.student.lastName, "Cruz");
    assert.equal(Object.hasOwn(result.sessions[0] ?? {}, "attendanceRecords"), false);
    assert.equal(Object.hasOwn(result.sessions[0] ?? {}, "internalValue"), false);
  }

  assert.deepEqual(await listAttendanceSessions(classId, createDependencies({
    classExists: async () => false,
  })), { status: "class_not_found" });
});

test("loadAttendanceSession returns one safe session or null", async () => {
  const loaded = await loadAttendanceSession(sessionId, createDependencies());
  const missing = await loadAttendanceSession(sessionId, createDependencies({
    findSession: async () => null,
  }));

  assert.equal(loaded?.id, sessionId);
  assert.equal(loaded?.records[1]?.status, "P");
  assert.equal(missing, null);
});

test("deleteAttendanceSession reports whether the complete date was removed", async () => {
  let receivedSessionId = "";
  const deleted = await deleteAttendanceSession(sessionId, createDependencies({
    deleteSession: async (currentSessionId) => {
      receivedSessionId = currentSessionId;
      return true;
    },
  }));
  const missing = await deleteAttendanceSession(sessionId, createDependencies({
    deleteSession: async () => false,
  }));

  assert.equal(receivedSessionId, sessionId);
  assert.equal(deleted, true);
  assert.equal(missing, false);
});

test("saveAttendanceRecords maps and updates the exact roster in one dependency call", async () => {
  let updateCalls = 0;
  let receivedRecords:
    | Parameters<AttendanceServiceDependencies["updateSessionRecords"]>[1]
    | undefined;
  const result = await saveAttendanceRecords(
    sessionId,
    [
      { studentId: firstStudentId, status: "L", remarks: null },
      { studentId: secondStudentId, status: "E", remarks: "Medical appointment" },
    ],
    createDependencies({
      updateSessionRecords: async (_receivedSessionId, records) => {
        updateCalls += 1;
        receivedRecords = records;
        return storedSession;
      },
    }),
  );

  assert.equal(result.status, "saved");
  assert.equal(updateCalls, 1);
  assert.deepEqual(receivedRecords, [
    { studentId: firstStudentId, status: AttendanceStatus.LATE, remarks: null },
    {
      studentId: secondStudentId,
      status: AttendanceStatus.EXCUSED,
      remarks: "Medical appointment",
    },
  ]);
});

test("saveAttendanceRecords rejects missing, extra, and duplicate students", async () => {
  const missing = await saveAttendanceRecords(sessionId, [
    { studentId: firstStudentId, status: "P", remarks: null },
  ], createDependencies());
  const extra = await saveAttendanceRecords(sessionId, [
    { studentId: firstStudentId, status: "P", remarks: null },
    { studentId: extraStudentId, status: "A", remarks: null },
  ], createDependencies());
  const duplicate = await saveAttendanceRecords(sessionId, [
    { studentId: firstStudentId, status: "P", remarks: null },
    { studentId: firstStudentId, status: "A", remarks: null },
  ], createDependencies());

  assert.deepEqual(missing, { status: "roster_mismatch" });
  assert.deepEqual(extra, { status: "roster_mismatch" });
  assert.deepEqual(duplicate, { status: "student_duplicate" });
});

test("saveAttendanceRecords returns not found without attempting an update", async () => {
  let updateWasCalled = false;
  const result = await saveAttendanceRecords(sessionId, [
    { studentId: firstStudentId, status: null, remarks: null },
  ], createDependencies({
    findSessionRoster: async () => null,
    updateSessionRecords: async () => {
      updateWasCalled = true;
      return storedSession;
    },
  }));

  assert.deepEqual(result, { status: "session_not_found" });
  assert.equal(updateWasCalled, false);
});
