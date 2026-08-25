// Verifies class input normalization, strictness, and date-range validation.
import assert from "node:assert/strict";
import test from "node:test";

import {
  classIdParamsSchema,
  createClassSchema,
  updateClassSchema,
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
    schedules: [],
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

// Confirms valid weekly rows are normalized into Monday-through-Sunday order.
test("createClassSchema accepts and orders valid weekly schedules", () => {
  const result = createClassSchema.parse({
    subjectName: "Database Systems",
    schedules: [
      { dayOfWeek: 4, startTime: "08:00", endTime: "10:30" },
      { dayOfWeek: 2, startTime: "09:00", endTime: "11:00" },
    ],
  });

  assert.deepEqual(result.schedules, [
    { dayOfWeek: 2, startTime: "09:00", endTime: "11:00" },
    { dayOfWeek: 4, startTime: "08:00", endTime: "10:30" },
  ]);
});

// Confirms omission and an intentional empty set follow their separate contracts.
test("class schemas accept omitted and empty schedule arrays", () => {
  const createResult = createClassSchema.parse({ subjectName: "Database Systems" });
  const omittedUpdate = updateClassSchema.parse({ subjectName: "Database Systems" });
  const emptyUpdate = updateClassSchema.parse({
    subjectName: "Database Systems",
    schedules: [],
  });

  assert.deepEqual(createResult.schedules, []);
  assert.equal(Object.hasOwn(omittedUpdate, "schedules"), false);
  assert.deepEqual(emptyUpdate.schedules, []);
});

// Confirms ISO weekday bounds and whole-number values are enforced.
test("createClassSchema rejects invalid weekdays", () => {
  for (const dayOfWeek of [0, 8, 2.5]) {
    assert.equal(createClassSchema.safeParse({
      subjectName: "Database Systems",
      schedules: [{ dayOfWeek, startTime: "09:00", endTime: "11:00" }],
    }).success, false);
  }
});

// Confirms the one-row-per-weekday rule is enforced before persistence.
test("createClassSchema rejects duplicate weekdays", () => {
  const result = createClassSchema.safeParse({
    subjectName: "Database Systems",
    schedules: [
      { dayOfWeek: 2, startTime: "09:00", endTime: "11:00" },
      { dayOfWeek: 2, startTime: "13:00", endTime: "15:00" },
    ],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(JSON.stringify(result.error.issues), /only once/);
  }
});

// Confirms exact 24-hour HH:mm values are required, including rejecting 24:00.
test("createClassSchema rejects invalid schedule time formats", () => {
  for (const startTime of ["9:00", "09:0", "24:00", "09:60"]) {
    assert.equal(createClassSchema.safeParse({
      subjectName: "Database Systems",
      schedules: [{ dayOfWeek: 2, startTime, endTime: "11:00" }],
    }).success, false);
  }
});

// Confirms equal, reversed, and overnight weekly ranges are not accepted.
test("createClassSchema rejects non-increasing schedule ranges", () => {
  for (const endTime of ["09:00", "08:59", "01:00"]) {
    const result = createClassSchema.safeParse({
      subjectName: "Database Systems",
      schedules: [{ dayOfWeek: 2, startTime: "09:00", endTime }],
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(JSON.stringify(result.error.issues), /later than start time/);
    }
  }
});

// Confirms a weekly schedule cannot exceed the seven ISO weekdays.
test("createClassSchema rejects more than seven schedule rows", () => {
  const result = createClassSchema.safeParse({
    subjectName: "Database Systems",
    schedules: Array.from({ length: 8 }, (_, index) => ({
      dayOfWeek: (index % 7) + 1,
      startTime: "09:00",
      endTime: "11:00",
    })),
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(JSON.stringify(result.error.issues), /at most seven/);
  }
});

// Confirms nested schedule records remain strict at the request boundary.
test("createClassSchema rejects unknown schedule fields", () => {
  const result = createClassSchema.safeParse({
    subjectName: "Database Systems",
    schedules: [{
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "11:00",
      timezone: "Asia/Manila",
    }],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(JSON.stringify(result.error.issues), /Unrecognized key/);
  }
});
