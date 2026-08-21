import assert from "node:assert/strict";
import test from "node:test";

import { loginSchema } from "./auth.schema.js";

test("loginSchema normalizes valid login input", () => {
  const result = loginSchema.parse({
    email: "  Admin@Example.com ",
    password: "correct horse battery staple",
  });

  assert.deepEqual(result, {
    email: "admin@example.com",
    password: "correct horse battery staple",
    rememberMe: false,
  });
});

test("loginSchema rejects invalid and unknown fields", () => {
  const result = loginSchema.safeParse({
    email: "not-an-email",
    password: "",
    role: "ADMIN",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const invalidFields = new Set(result.error.issues.flatMap((issue) => issue.path));

    assert.equal(invalidFields.has("email"), true);
    assert.equal(invalidFields.has("password"), true);
    assert.equal(result.error.issues.some((issue) => issue.code === "unrecognized_keys"), true);
  }
});
