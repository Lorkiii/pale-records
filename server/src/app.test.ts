// Verifies request validation, body limits, and credentialed CORS behavior.
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { app } from "./app.js";

test("login rejects invalid identifiers before reaching authentication", async () => {
  const response = await request(app).post("/api/auth/login").send({
    identifier: "not a valid username",
    password: "password",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});

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

test("oversized JSON bodies are rejected with HTTP 413", async () => {
  const response = await request(app).post("/api/auth/login").send({
    identifier: "admin",
    password: "x".repeat(17_000),
  });

  assert.equal(response.status, 413);
  assert.equal(response.body.error.code, "PAYLOAD_TOO_LARGE");
});

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
