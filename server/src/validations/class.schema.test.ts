// Verifies class input normalization, strictness, and date-range validation.
import assert from "node:assert/strict";
import test from "node:test";

import {
  classIdParamsSchema,
  createClassSchema,
} from "./class.schema.js";

// Confirms accepted class input is normalized before it reaches the service.
test("createClassSchema trims fields and removes blank optional values", () => {
  const result = createClassSchema.parse({
    subjectName: "  Database Systems  ",
    subjectCode: "  CS 321  ",
    section: "   ",
    startDate: "2026-08-24",
    endDate: "2026-12-18",
  });

  assert.deepEqual(result, {
    subjectName: "Database Systems",
    subjectCode: "CS 321",
    section: undefined,
    startDate: "2026-08-24",
    endDate: "2026-12-18",
  });
});

// Confirms required fields, strict keys, and real calendar dates are enforced together.
test("createClassSchema rejects missing names, unknown fields, and invalid dates", () => {
  const result = createClassSchema.safeParse({
    subjectName: " ",
    startDate: "2026-02-31",
    studentCount: 25,
  });

  assert.equal(result.success, false);

  if (!result.success) {
    const issues = JSON.stringify(result.error.issues);
    assert.match(issues, /Subject name is required/);
    assert.match(issues, /valid calendar date/);
    assert.match(issues, /Unrecognized key/);
  }
});

// Confirms a reversed date range is reported against the end-date field.
test("createClassSchema rejects an end date before the start date", () => {
  const result = createClassSchema.safeParse({
    subjectName: "Software Engineering",
    startDate: "2026-12-01",
    endDate: "2026-08-24",
  });

  assert.equal(result.success, false);

  if (!result.success) {
    assert.equal(result.error.issues[0]?.path[0], "endDate");
    assert.match(result.error.issues[0]?.message ?? "", /on or after/);
  }
});

// Confirms route parameter validation accepts UUIDs and rejects arbitrary identifiers.
test("classIdParamsSchema accepts only a UUID class identifier", () => {
  assert.equal(
    classIdParamsSchema.safeParse({
      classId: "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0",
    }).success,
    true,
  );
  assert.equal(
    classIdParamsSchema.safeParse({ classId: "not-a-class-id" }).success,
    false,
  );
});
