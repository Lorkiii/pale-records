// Verifies student input normalization, strictness, and multi-class validation.
import assert from "node:assert/strict";
import test from "node:test";

import { createStudentSchema } from "./student.schema.js";

const firstClassId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const secondClassId = "55458380-0362-46bd-b3bb-cc6e880ab57e";

// Confirms optional student numbers and names are normalized before service use.
test("createStudentSchema trims names and uppercases the student number", () => {
  const result = createStudentSchema.parse({
    studentNo: "  ab-123  ",
    firstName: "  Ana  ",
    lastName: "  Reyes  ",
    classIds: [firstClassId, secondClassId],
  });

  assert.deepEqual(result, {
    studentNo: "AB-123",
    firstName: "Ana",
    lastName: "Reyes",
    classIds: [firstClassId, secondClassId],
  });
});

// Confirms a blank optional student number is removed from parsed input.
test("createStudentSchema removes a blank optional student number", () => {
  const result = createStudentSchema.parse({
    studentNo: "   ",
    firstName: "Ana",
    lastName: "Reyes",
    classIds: [firstClassId],
  });

  assert.equal(result.studentNo, undefined);
});

// Confirms required identity fields and at least one valid class are enforced.
test("createStudentSchema rejects missing names and invalid class selections", () => {
  const missingResult = createStudentSchema.safeParse({
    firstName: " ",
    lastName: " ",
    classIds: [],
  });
  const invalidIdResult = createStudentSchema.safeParse({
    firstName: "Ana",
    lastName: "Reyes",
    classIds: ["not-a-class-id"],
  });

  assert.equal(missingResult.success, false);
  assert.equal(invalidIdResult.success, false);
});

// Confirms duplicate assignments and unknown request fields are rejected.
test("createStudentSchema rejects duplicate classes and unknown fields", () => {
  const result = createStudentSchema.safeParse({
    firstName: "Ana",
    lastName: "Reyes",
    classIds: [firstClassId, firstClassId],
    role: "ADMIN",
  });

  assert.equal(result.success, false);

  if (!result.success) {
    const issues = JSON.stringify(result.error.issues);
    assert.match(issues, /Select each class only once/);
    assert.match(issues, /Unrecognized key/);
  }
});
