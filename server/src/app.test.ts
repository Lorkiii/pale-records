// Verifies auth boundaries, request limits, and credentialed CORS behavior.
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { app } from "./app.js";

// Confirms malformed login identifiers fail before credential lookup.
test("login rejects invalid identifiers before reaching authentication", async () => {
  const response = await request(app).post("/api/auth/login").send({
    identifier: "not a valid username",
    password: "password",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

// Confirms session lookup denies requests without the HTTP-only authentication cookie.
test("session lookup requires an authenticated cookie", async () => {
  const response = await request(app).get("/api/auth/session");

  assert.equal(response.status, 401);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    },
  });
});

// Confirms invalid session tokens are denied and removed from the browser.
test("session lookup clears an invalid authenticated cookie", async () => {
  const response = await request(app)
    .get("/api/auth/session")
    .set("Cookie", "pale.auth=invalid-session-token");

  assert.equal(response.status, 401);
  assert.match(response.headers["set-cookie"]?.[0] ?? "", /^pale\.auth=;/);
  assert.equal(response.body.error.code, "UNAUTHENTICATED");
});

// Confirms every class operation is protected by the shared session middleware.
test("class endpoints require an authenticated session", async () => {
  const listResponse = await request(app).get("/api/classes");
  const createResponse = await request(app).post("/api/classes").send({
    subjectName: "Database Systems",
  });
  const updateResponse = await request(app)
    .patch("/api/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0")
    .send({ subjectName: "Advanced Database Systems" });
  const archiveResponse = await request(app)
    .post("/api/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0/archive");

  assert.equal(listResponse.status, 401);
  assert.equal(listResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(createResponse.status, 401);
  assert.equal(createResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(updateResponse.status, 401);
  assert.equal(updateResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(archiveResponse.status, 401);
  assert.equal(archiveResponse.body.error.code, "UNAUTHENTICATED");
});

// Confirms every student operation is protected by the shared session middleware.
test("student endpoints require an authenticated session", async () => {
  const listResponse = await request(app).get("/api/students");
  const createResponse = await request(app).post("/api/students").send({
    firstName: "Ana",
    lastName: "Reyes",
    classIds: ["2c6e62cc-584d-4faf-90f6-fdb50b27c9d0"],
  });
  const updateResponse = await request(app)
    .patch("/api/students/a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c")
    .send({
      firstName: "Ana",
      lastName: "Reyes",
      classIds: ["2c6e62cc-584d-4faf-90f6-fdb50b27c9d0"],
    });
  const archiveResponse = await request(app)
    .post("/api/students/a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c/archive");

  assert.equal(listResponse.status, 401);
  assert.equal(listResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(createResponse.status, 401);
  assert.equal(createResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(updateResponse.status, 401);
  assert.equal(updateResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(archiveResponse.status, 401);
  assert.equal(archiveResponse.body.error.code, "UNAUTHENTICATED");
});

// Confirms the registered Attendance router protects every endpoint before validation or data access.
test("Attendance endpoints require an authenticated session", async () => {
  const createResponse = await request(app)
    .post("/api/attendance/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0/sessions")
    .send({ sessionDate: "2026-08-25" });
  const monthResponse = await request(app)
    .post("/api/attendance/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0/session-months")
    .send({ year: 2026, month: 8 });
  const listResponse = await request(app)
    .get("/api/attendance/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0/sessions");
  const loadResponse = await request(app)
    .get("/api/attendance/sessions/099aa026-ef03-4ab6-92ee-68fa37fb6523");
  const deleteResponse = await request(app)
    .delete("/api/attendance/sessions/099aa026-ef03-4ab6-92ee-68fa37fb6523");
  const saveResponse = await request(app)
    .put("/api/attendance/sessions/099aa026-ef03-4ab6-92ee-68fa37fb6523/records")
    .send({ records: [] });

  for (const response of [
    createResponse,
    monthResponse,
    listResponse,
    loadResponse,
    deleteResponse,
    saveResponse,
  ]) {
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "UNAUTHENTICATED");
  }
});

// Confirms the registered Recitation router protects every endpoint before validation or data access.
test("Recitation endpoints require an authenticated session", async () => {
  const createResponse = await request(app)
    .post("/api/recitations/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0/sessions")
    .send({ sessionDate: "2026-08-27" });
  const listResponse = await request(app)
    .get("/api/recitations/classes/2c6e62cc-584d-4faf-90f6-fdb50b27c9d0/sessions?year=2026&month=8");
  const loadResponse = await request(app)
    .get("/api/recitations/sessions/099aa026-ef03-4ab6-92ee-68fa37fb6523");
  const deleteResponse = await request(app)
    .delete("/api/recitations/sessions/099aa026-ef03-4ab6-92ee-68fa37fb6523");
  const saveResponse = await request(app)
    .put("/api/recitations/sessions/099aa026-ef03-4ab6-92ee-68fa37fb6523/records")
    .send({ records: [] });

  for (const response of [
    createResponse,
    listResponse,
    loadResponse,
    deleteResponse,
    saveResponse,
  ]) {
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "UNAUTHENTICATED");
  }
});

// Confirms the registered Agenda router protects every endpoint before validation or data access.
test("Agenda endpoints require an authenticated session", async () => {
  const listResponse = await request(app)
    .get("/api/agenda/events?from=2026-09-01&to=2026-09-30");
  const createResponse = await request(app)
    .post("/api/agenda/events")
    .send({
      title: "Final examination",
      eventDate: "2026-09-15",
      isAllDay: true,
      eventType: "EXAM",
    });
  const importResponse = await request(app)
    .post("/api/agenda/events/import")
    .send({
      legacyEventId: "evt_1724900000000_ab12cd3",
      title: "Final examination",
      eventDate: "2026-09-15",
      isAllDay: true,
      eventType: "EXAM",
    });
  const updateResponse = await request(app)
    .patch("/api/agenda/events/099aa026-ef03-4ab6-92ee-68fa37fb6523")
    .send({
      title: "Updated examination",
      eventDate: "2026-09-15",
      isAllDay: true,
      eventType: "EXAM",
    });
  const deleteResponse = await request(app)
    .delete("/api/agenda/events/099aa026-ef03-4ab6-92ee-68fa37fb6523");

  for (const response of [
    listResponse,
    createResponse,
    importResponse,
    updateResponse,
    deleteResponse,
  ]) {
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "UNAUTHENTICATED");
  }
});

// Confirms Express syntax failures are converted into the safe API error contract.
test("malformed JSON uses the safe API error response", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send('{"identifier":');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: "MALFORMED_JSON",
      message: "The request body must contain valid JSON.",
    },
  });
});

// Confirms the configured body limit rejects oversized credential payloads.
test("oversized JSON bodies are rejected with HTTP 413", async () => {
  const response = await request(app).post("/api/auth/login").send({
    identifier: "admin",
    password: "x".repeat(17_000),
  });

  assert.equal(response.status, 413);
  assert.equal(response.body.error.code, "PAYLOAD_TOO_LARGE");
});

// Confirms credentialed cross-origin access is limited to configured client origins.
test("CORS exposes credentialed responses only to the configured client", async () => {
  const allowedResponse = await request(app)
    .options("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "POST");
  const deniedResponse = await request(app)
    .options("/api/auth/login")
    .set("Origin", "https://untrusted.example")
    .set("Access-Control-Request-Method", "POST");

  assert.equal(
    allowedResponse.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
  assert.equal(
    allowedResponse.headers["access-control-allow-credentials"],
    "true",
  );
  assert.equal(
    deniedResponse.headers["access-control-allow-origin"],
    undefined,
  );
});
