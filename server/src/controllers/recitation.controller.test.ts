// Verifies Recitation HTTP statuses, query validation, safe envelopes, and error forwarding.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import {
  createRecitationControllerHandlers,
  type RecitationControllerDependencies,
} from "./recitation.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import { validateQuery } from "../middleware/validate-query.js";
import {
  createRecitationSessionSchema,
  listRecitationSessionsQuerySchema,
  recitationClassIdParamsSchema,
  recitationSessionIdParamsSchema,
  saveRecitationRecordsSchema,
} from "../validations/recitation.schema.js";
import type { RecitationSessionRecord } from "../validations/recitation.response.js";

const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const sessionId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const studentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

const publicSession: RecitationSessionRecord = {
  id: sessionId,
  classId,
  sessionDate: "2026-08-27",
  isRosterInitialized: true,
  records: [{
    id: "6fd5133c-0985-49a2-b3dc-10a3b03110de",
    student: {
      id: studentId,
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
    },
    mark: null,
  }],
};

const publicDraftSession: RecitationSessionRecord = {
  ...publicSession,
  isRosterInitialized: false,
  records: publicSession.records.map((record) => ({
    ...record,
    id: null,
    mark: null,
  })),
};

// Mounts controller-focused routes without authentication to isolate service outcomes.
function createTestApp(
  overrides: Partial<RecitationControllerDependencies> = {},
) {
  const dependencies: RecitationControllerDependencies = {
    createSession: async () => ({ status: "created", session: publicDraftSession }),
    deleteSession: async () => true,
    listSessions: async () => ({ status: "found", sessions: [publicDraftSession] }),
    loadSession: async () => publicSession,
    saveRecords: async () => ({ status: "saved", session: publicSession }),
    ...overrides,
  };
  const handlers = createRecitationControllerHandlers(dependencies);
  const testApp = express();
  testApp.use(express.json());
  testApp.post(
    "/classes/:classId/sessions",
    validateParams(recitationClassIdParamsSchema),
    validateBody(createRecitationSessionSchema),
    handlers.createRecitationSessionController,
  );
  testApp.get(
    "/classes/:classId/sessions",
    validateParams(recitationClassIdParamsSchema),
    validateQuery(listRecitationSessionsQuerySchema),
    handlers.listRecitationSessionsController,
  );
  testApp.get(
    "/sessions/:sessionId",
    validateParams(recitationSessionIdParamsSchema),
    handlers.loadRecitationSessionController,
  );
  testApp.delete(
    "/sessions/:sessionId",
    validateParams(recitationSessionIdParamsSchema),
    handlers.deleteRecitationSessionController,
  );
  testApp.put(
    "/sessions/:sessionId/records",
    validateParams(recitationSessionIdParamsSchema),
    validateBody(saveRecitationRecordsSchema),
    handlers.saveRecitationRecordsController,
  );
  testApp.use(errorHandler);
  return testApp;
}

test("Recitation controllers return safe success statuses and envelopes", async () => {
  let receivedMonth: [number, number] | undefined;
  const testApp = createTestApp({
    listSessions: async (_classId, year, month) => {
      receivedMonth = [year, month];
      return { status: "found", sessions: [publicDraftSession] };
    },
  });
  const createResponse = await request(testApp)
    .post(`/classes/${classId}/sessions`)
    .send({ sessionDate: "2026-08-27" });
  const listResponse = await request(testApp)
    .get(`/classes/${classId}/sessions?year=2026&month=8`);
  const loadResponse = await request(testApp).get(`/sessions/${sessionId}`);
  const deleteResponse = await request(testApp).delete(`/sessions/${sessionId}`);
  const saveResponse = await request(testApp)
    .put(`/sessions/${sessionId}/records`)
    .send({ records: [{ studentId, mark: null }] });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.data.session.id, sessionId);
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.data.sessions.length, 1);
  assert.deepEqual(receivedMonth, [2026, 8]);
  assert.equal(loadResponse.status, 200);
  assert.equal(loadResponse.body.data.session.sessionDate, "2026-08-27");
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.data.sessionId, sessionId);
  assert.equal(saveResponse.status, 200);
  assert.equal(saveResponse.body.data.session.records[0].student.id, studentId);
});

test("Recitation create controller returns safe class and duplicate-date outcomes", async () => {
  const cases: Array<{
    serviceStatus: "class_not_found" | "class_archived" | "session_exists";
    httpStatus: number;
    code: string;
  }> = [
    { serviceStatus: "class_not_found", httpStatus: 404, code: "CLASS_NOT_FOUND" },
    { serviceStatus: "class_archived", httpStatus: 409, code: "CLASS_ARCHIVED" },
    { serviceStatus: "session_exists", httpStatus: 409, code: "RECITATION_SESSION_EXISTS" },
  ];

  for (const currentCase of cases) {
    const response = await request(createTestApp({
      createSession: async () => ({ status: currentCase.serviceStatus }),
    }))
      .post(`/classes/${classId}/sessions`)
      .send({ sessionDate: "2026-08-27" });

    assert.equal(response.status, currentCase.httpStatus);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, currentCase.code);
  }
});

test("Recitation monthly listing validates query values before the service", async () => {
  let listWasCalled = false;
  const testApp = createTestApp({
    listSessions: async () => {
      listWasCalled = true;
      return { status: "found", sessions: [] };
    },
  });

  for (const query of [
    "year=1999&month=8",
    "year=2026&month=13",
    "year=2026&month=8&extra=value",
    "year=2026",
  ]) {
    const response = await request(testApp)
      .get(`/classes/${classId}/sessions?${query}`);
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal(listWasCalled, false);

  const missingResponse = await request(createTestApp({
    listSessions: async () => ({ status: "class_not_found" }),
  })).get(`/classes/${classId}/sessions?year=2026&month=8`);
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.body.error.code, "CLASS_NOT_FOUND");
});

test("Recitation load, delete, and save controllers return safe expected errors", async () => {
  const missingLoad = await request(createTestApp({
    loadSession: async () => null,
  })).get(`/sessions/${sessionId}`);
  const missingDelete = await request(createTestApp({
    deleteSession: async () => false,
  })).delete(`/sessions/${sessionId}`);
  const saveCases: Array<{
    serviceStatus: "session_not_found" | "student_duplicate" | "roster_mismatch";
    httpStatus: number;
    code: string;
  }> = [
    {
      serviceStatus: "session_not_found",
      httpStatus: 404,
      code: "RECITATION_SESSION_NOT_FOUND",
    },
    {
      serviceStatus: "student_duplicate",
      httpStatus: 400,
      code: "RECITATION_STUDENT_DUPLICATE",
    },
    {
      serviceStatus: "roster_mismatch",
      httpStatus: 409,
      code: "RECITATION_ROSTER_MISMATCH",
    },
  ];

  assert.equal(missingLoad.status, 404);
  assert.equal(missingLoad.body.error.code, "RECITATION_SESSION_NOT_FOUND");
  assert.equal(missingDelete.status, 404);
  assert.equal(missingDelete.body.error.code, "RECITATION_SESSION_NOT_FOUND");

  for (const currentCase of saveCases) {
    const response = await request(createTestApp({
      saveRecords: async () => ({ status: currentCase.serviceStatus }),
    }))
      .put(`/sessions/${sessionId}/records`)
      .send({ records: [{ studentId, mark: "CHECK" }] });
    assert.equal(response.status, currentCase.httpStatus);
    assert.equal(response.body.error.code, currentCase.code);
  }
});

test("invalid Recitation bodies and params are rejected before service access", async () => {
  let createWasCalled = false;
  let deleteWasCalled = false;
  const testApp = createTestApp({
    createSession: async () => {
      createWasCalled = true;
      return { status: "created", session: publicDraftSession };
    },
    deleteSession: async () => {
      deleteWasCalled = true;
      return true;
    },
  });
  const dateResponse = await request(testApp)
    .post(`/classes/${classId}/sessions`)
    .send({ sessionDate: "2026-02-30", extra: true });
  const paramResponse = await request(testApp)
    .get("/sessions/not-a-uuid");
  const deleteParamResponse = await request(testApp)
    .delete("/sessions/not-a-uuid");

  assert.equal(dateResponse.status, 400);
  assert.equal(dateResponse.body.error.code, "VALIDATION_ERROR");
  assert.equal(paramResponse.status, 400);
  assert.equal(paramResponse.body.error.code, "VALIDATION_ERROR");
  assert.equal(deleteParamResponse.status, 400);
  assert.equal(deleteParamResponse.body.error.code, "VALIDATION_ERROR");
  assert.equal(createWasCalled, false);
  assert.equal(deleteWasCalled, false);
});

test("unexpected Recitation errors reach the centralized safe error handler", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const listResponse = await request(createTestApp({
    listSessions: async () => {
      throw new Error("private database detail");
    },
  })).get(`/classes/${classId}/sessions?year=2026&month=8`);
  const deleteResponse = await request(createTestApp({
    deleteSession: async () => {
      throw new Error("private database detail");
    },
  })).delete(`/sessions/${sessionId}`);

  for (const response of [listResponse, deleteResponse]) {
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected server error occurred.",
      },
    });
  }
});
