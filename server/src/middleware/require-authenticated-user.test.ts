// Verifies stale private token versions cannot reach authenticated route handlers.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import { createRequireAuthenticatedUser } from "./require-authenticated-user.js";

const user = {
  id: "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c",
  firstName: "Ana",
  lastName: "Reyes",
  username: "ana.reyes",
  email: "ana@example.com",
  sessionVersion: 2,
};

test("a previously issued session version is rejected and its cookie is cleared", async () => {
  const testApp = express();
  testApp.get(
    "/protected",
    createRequireAuthenticatedUser({
      verifyToken: async () => ({ userId: user.id, sessionVersion: 1 }),
      findUser: async () => user,
    }),
    (_req, res) => res.status(200).json({ success: true }),
  );

  const response = await request(testApp)
    .get("/protected")
    .set("Cookie", "pale.auth=previously-issued-token");

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "UNAUTHENTICATED");
  assert.match(response.headers["set-cookie"]?.[0] ?? "", /^pale\.auth=;/);
});

test("a current token version reaches handlers without exposing the private version", async () => {
  const testApp = express();
  testApp.get(
    "/protected",
    createRequireAuthenticatedUser({
      verifyToken: async () => ({ userId: user.id, sessionVersion: 2 }),
      findUser: async () => user,
    }),
    (_req, res) => res.status(200).json({ user: res.locals.authenticatedUser }),
  );

  const response = await request(testApp)
    .get("/protected")
    .set("Cookie", "pale.auth=current-token");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.user, {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
  });
  assert.equal("sessionVersion" in response.body.user, false);
});
