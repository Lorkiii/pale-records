// Verifies Attendance HTTP statuses, envelopes, boundary validation, and unexpected-error forwarding.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import {
  createAttendanceControllerHandlers,
  type AttendanceControllerDependencies,
} from "./attendance.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import {
  attendanceClassIdParamsSchema,
  attendanceSessionIdParamsSchema,
  createAttendanceSessionSchema,
  saveAttendanceRecordsSchema,
} from "../validations/attendance.schema.js";
import type { AttendanceSessionRecord } from "../validations/attendance.response.js";

const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const sessionId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const studentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

const publicSession: AttendanceSessionRecord = {
  id: sessionId,
  classId,
  classScheduleId: null,
  sessionDate: "2026-08-25",
  startTime: null,
  endTime: null,
  records: [{
    id: "6fd5133c-0985-49a2-b3dc-10a3b03110de",
    student: {
      id: studentId,
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
    },
    status: null,
    remarks: null,
  }],
};

// Mounts controller-focused routes without authentication so service outcomes can be isolated.
function createTestApp(
  overrides: Partial<AttendanceControllerDependencies> = {},
) {
  const dependencies: AttendanceControllerDependencies = {
    createSession: async () => ({ status: "created", session: publicSession }),
    deleteSession: async () => true,
    listSessions: async () => ({ status: "found", sessions: [publicSession] }),
    loadSession: async () => publicSession,
    saveRecords: async () => ({ status: "saved", session: publicSession }),
    ...overrides,
  };
  const handlers = createAttendanceControllerHandlers(dependencies);
  const testApp = express();
  testApp.use(express.json());
  testApp.post(
    "/classes/:classId/sessions",
    validateParams(attendanceClassIdParamsSchema),
    validateBody(createAttendanceSessionSchema),
    handlers.createAttendanceSessionController,
  );
  testApp.get(
    "/classes/:classId/sessions",
    validateParams(attendanceClassIdParamsSchema),
    handlers.listAttendanceSessionsController,
  );
  testApp.get(
    "/sessions/:sessionId",
    validateParams(attendanceSessionIdParamsSchema),
    handlers.loadAttendanceSessionController,
  );
  testApp.delete(
    "/sessions/:sessionId",
    validateParams(attendanceSessionIdParamsSchema),
    handlers.deleteAttendanceSessionController,
  );
  testApp.put(
    "/sessions/:sessionId/records",
    validateParams(attendanceSessionIdParamsSchema),
    validateBody(saveAttendanceRecordsSchema),
    handlers.saveAttendanceRecordsController,
  );
  testApp.use(errorHandler);
  return testApp;
}

test("Attendance controllers return correct success statuses and envelopes", async () => {
  const testApp = createTestApp();
  const createResponse = await request(testApp)
    .post(`/classes/${classId}/sessions`)
    .send({ sessionDate: "2026-08-25" });
  const listResponse = await request(testApp).get(`/classes/${classId}/sessions`);
  const loadResponse = await request(testApp).get(`/sessions/${sessionId}`);
  const deleteResponse = await request(testApp).delete(`/sessions/${sessionId}`);
  const saveResponse = await request(testApp)
    .put(`/sessions/${sessionId}/records`)
    .send({ records: [{ studentId, status: null, remarks: null }] });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.data.session.id, sessionId);
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.data.sessions.length, 1);
  assert.equal(loadResponse.status, 200);
  assert.equal(loadResponse.body.data.session.sessionDate, "2026-08-25");
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.data.sessionId, sessionId);
  assert.equal(saveResponse.status, 200);
  assert.equal(saveResponse.body.data.session.records[0].student.id, studentId);
});

test("Attendance create controller returns safe expected product conflicts", async () => {
  const cases: Array<{
    serviceStatus: "class_not_found" | "class_archived" | "class_has_no_students" | "session_exists";
    httpStatus: number;
    code: string;
  }> = [
    { serviceStatus: "class_not_found", httpStatus: 404, code: "CLASS_NOT_FOUND" },
    { serviceStatus: "class_archived", httpStatus: 409, code: "CLASS_ARCHIVED" },
    { serviceStatus: "class_has_no_students", httpStatus: 409, code: "CLASS_HAS_NO_STUDENTS" },
    { serviceStatus: "session_exists", httpStatus: 409, code: "ATTENDANCE_SESSION_EXISTS" },
  ];

  for (const currentCase of cases) {
    const response = await request(createTestApp({
      createSession: async () => ({ status: currentCase.serviceStatus }),
    }))
      .post(`/classes/${classId}/sessions`)
      .send({ sessionDate: "2026-08-25" });

    assert.equal(response.status, currentCase.httpStatus);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, currentCase.code);
  }
});

test("Attendance load and save controllers return safe missing and roster errors", async () => {
  const missingResponse = await request(createTestApp({
    loadSession: async () => null,
  })).get(`/sessions/${sessionId}`);
  const mismatchResponse = await request(createTestApp({
    saveRecords: async () => ({ status: "roster_mismatch" }),
  }))
    .put(`/sessions/${sessionId}/records`)
    .send({ records: [{ studentId, status: "P", remarks: null }] });

  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.body.error.code, "ATTENDANCE_SESSION_NOT_FOUND");
  assert.equal(mismatchResponse.status, 409);
  assert.equal(mismatchResponse.body.error.code, "ATTENDANCE_ROSTER_MISMATCH");
});

test("Attendance delete controller returns the safe missing-session error", async () => {
  const response = await request(createTestApp({
    deleteSession: async () => false,
  })).delete(`/sessions/${sessionId}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "ATTENDANCE_SESSION_NOT_FOUND");
});

test("invalid Attendance input is rejected before the service path", async () => {
  let createWasCalled = false;
  const response = await request(createTestApp({
    createSession: async () => {
      createWasCalled = true;
      return { status: "created", session: publicSession };
    },
  }))
    .post(`/classes/${classId}/sessions`)
    .send({ sessionDate: "2026-02-30", extra: true });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.equal(createWasCalled, false);
});

test("unexpected Attendance service errors reach the centralized error handler", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const response = await request(createTestApp({
    listSessions: async () => {
      throw new Error("private database detail");
    },
  })).get(`/classes/${classId}/sessions`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
});
