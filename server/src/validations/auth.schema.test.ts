// Verifies accepted login identifiers, normalization, and protected-field rejection.
import assert from "node:assert/strict";
import test from "node:test";

import { loginSchema } from "./auth.schema.js";

test("loginSchema normalizes an email identifier", () => {
  const result = loginSchema.parse({
    identifier: "  Admin@Example.com ",
    password: "correct horse battery staple",
  });

  assert.deepEqual(result, {
    identifier: "admin@example.com",
    password: "correct horse battery staple",
    rememberMe: false,
  });
});

test("loginSchema accepts and normalizes a username", () => {
  const result = loginSchema.parse({
    identifier: "  PALE.Admin ",
    password: "correct horse battery staple",
    rememberMe: true,
  });

  assert.deepEqual(result, {
    identifier: "pale.admin",
    password: "correct horse battery staple",
    rememberMe: true,
  });
});

test("loginSchema keeps the original email payload compatible", () => {
  const result = loginSchema.parse({
    email: " Admin@Example.com ",
    password: "correct horse battery staple",
  });

  assert.equal(result.identifier, "admin@example.com");
});

test("loginSchema rejects invalid and unknown fields", () => {
  const result = loginSchema.safeParse({
    identifier: "not a valid username",
    password: "",
    role: "ADMIN",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const serializedIssues = JSON.stringify(result.error.issues);

    assert.match(serializedIssues, /"identifier"/);
    assert.match(serializedIssues, /"password"/);
    assert.match(serializedIssues, /"role"/);
  }
});
