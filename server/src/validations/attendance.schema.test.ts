// Verifies Attendance date, status, remarks, roster, strictness, and parameter validation.
import assert from "node:assert/strict";
import test from "node:test";

import {
  attendanceClassIdParamsSchema,
  attendanceSessionIdParamsSchema,
  createAttendanceSessionSchema,
  saveAttendanceRecordsSchema,
} from "./attendance.schema.js";

const firstStudentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const secondStudentId = "1d7f6a68-01d8-4abe-9f17-c3d03ed4ad86";

// Builds one valid record while allowing each validation case to override a field.
function attendanceRecord(overrides: Record<string, unknown> = {}) {
  return {
    studentId: firstStudentId,
    status: "P",
    remarks: null,
    ...overrides,
  };
}

test("createAttendanceSessionSchema accepts a real date-only value", () => {
  assert.deepEqual(createAttendanceSessionSchema.parse({
    sessionDate: "2026-08-25",
  }), { sessionDate: "2026-08-25" });
});

test("createAttendanceSessionSchema rejects malformed and impossible dates", () => {
  for (const sessionDate of ["08/25/2026", "2026-8-25", "2026-02-30"]) {
    assert.equal(createAttendanceSessionSchema.safeParse({ sessionDate }).success, false);
  }
});

test("saveAttendanceRecordsSchema accepts P, A, L, E, and null", () => {
  for (const status of ["P", "A", "L", "E", null]) {
    const result = saveAttendanceRecordsSchema.safeParse({
      records: [attendanceRecord({
        status,
        remarks: status === "E" ? "  Medical appointment  " : undefined,
      })],
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(
        result.data.records[0]?.remarks,
        status === "E" ? "Medical appointment" : null,
      );
    }
  }
});

test("saveAttendanceRecordsSchema rejects invalid PALE status codes", () => {
  assert.equal(saveAttendanceRecordsSchema.safeParse({
    records: [attendanceRecord({ status: "PRESENT" })],
  }).success, false);
});

test("saveAttendanceRecordsSchema requires a non-blank Excused remark", () => {
  for (const remarks of [undefined, null, "   "]) {
    assert.equal(saveAttendanceRecordsSchema.safeParse({
      records: [attendanceRecord({ status: "E", remarks })],
    }).success, false);
  }
});

test("saveAttendanceRecordsSchema rejects remarks for non-Excused statuses", () => {
  assert.equal(saveAttendanceRecordsSchema.safeParse({
    records: [attendanceRecord({ status: "A", remarks: "Not excused" })],
  }).success, false);
});

test("saveAttendanceRecordsSchema rejects remarks over 1000 characters", () => {
  assert.equal(saveAttendanceRecordsSchema.safeParse({
    records: [attendanceRecord({ status: "E", remarks: "x".repeat(1_001) })],
  }).success, false);
});

test("saveAttendanceRecordsSchema rejects duplicate student identifiers", () => {
  const result = saveAttendanceRecordsSchema.safeParse({
    records: [attendanceRecord(), attendanceRecord({ status: "A" })],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(JSON.stringify(result.error.issues), /exactly once/);
  }
});

test("saveAttendanceRecordsSchema rejects more than 100 records", () => {
  const records = Array.from({ length: 101 }, (_, index) => attendanceRecord({
    studentId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  }));

  assert.equal(saveAttendanceRecordsSchema.safeParse({ records }).success, false);
});

test("Attendance request schemas reject unknown fields", () => {
  assert.equal(createAttendanceSessionSchema.safeParse({
    sessionDate: "2026-08-25",
    classScheduleId: "client-controlled",
  }).success, false);
  assert.equal(saveAttendanceRecordsSchema.safeParse({
    records: [attendanceRecord({ proofUrl: "https://example.invalid/file" })],
  }).success, false);
});

test("Attendance parameter schemas accept only UUID identifiers", () => {
  assert.equal(attendanceClassIdParamsSchema.safeParse({
    classId: "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0",
  }).success, true);
  assert.equal(attendanceClassIdParamsSchema.safeParse({ classId: "class-one" }).success, false);
  assert.equal(attendanceSessionIdParamsSchema.safeParse({
    sessionId: "099aa026-ef03-4ab6-92ee-68fa37fb6523",
  }).success, true);
  assert.equal(attendanceSessionIdParamsSchema.safeParse({ sessionId: "session-one" }).success, false);
});
