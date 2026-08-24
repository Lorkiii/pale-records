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

// Confirms both student operations are protected by the shared session middleware.
test("student endpoints require an authenticated session", async () => {
  const listResponse = await request(app).get("/api/students");
  const createResponse = await request(app).post("/api/students").send({
    firstName: "Ana",
    lastName: "Reyes",
    classIds: ["2c6e62cc-584d-4faf-90f6-fdb50b27c9d0"],
  });

  assert.equal(listResponse.status, 401);
  assert.equal(listResponse.body.error.code, "UNAUTHENTICATED");
  assert.equal(createResponse.status, 401);
  assert.equal(createResponse.body.error.code, "UNAUTHENTICATED");
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
