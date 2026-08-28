// Verifies strict Recitation dates, month queries, marks, rosters, and identifier validation.
import assert from "node:assert/strict";
import test from "node:test";

import {
  createRecitationSessionSchema,
  listRecitationSessionsQuerySchema,
  recitationClassIdParamsSchema,
  recitationSessionIdParamsSchema,
  saveRecitationRecordsSchema,
} from "./recitation.schema.js";

const firstStudentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

// Builds one valid record while allowing individual validation cases to vary fields.
function recitationRecord(overrides: Record<string, unknown> = {}) {
  return {
    studentId: firstStudentId,
    mark: "CHECK",
    ...overrides,
  };
}

test("Recitation accepts real date-only values and rejects invalid dates", () => {
  assert.deepEqual(createRecitationSessionSchema.parse({
    sessionDate: "2026-08-27",
  }), { sessionDate: "2026-08-27" });

  for (const sessionDate of ["08/27/2026", "2026-8-27", "2026-02-30"]) {
    assert.equal(createRecitationSessionSchema.safeParse({ sessionDate }).success, false);
  }
});

test("Recitation month query normalizes only bounded year and month strings", () => {
  assert.deepEqual(listRecitationSessionsQuerySchema.parse({
    year: "2026",
    month: "8",
  }), { year: 2026, month: 8 });
  assert.deepEqual(listRecitationSessionsQuerySchema.parse({
    year: "2000",
    month: "12",
  }), { year: 2000, month: 12 });

  for (const query of [
    { year: "1999", month: "8" },
    { year: "2101", month: "8" },
    { year: "2026.5", month: "8" },
    { year: "2026", month: "0" },
    { year: "2026", month: "13" },
    { year: ["2026"], month: "8" },
    { year: "2026", month: "8", extra: "value" },
  ]) {
    assert.equal(listRecitationSessionsQuerySchema.safeParse(query).success, false);
  }
});

test("Recitation records accept CHECK, X, null, and a genuine empty roster", () => {
  for (const mark of ["CHECK", "X", null]) {
    assert.equal(saveRecitationRecordsSchema.safeParse({
      records: [recitationRecord({ mark })],
    }).success, true);
  }

  assert.deepEqual(saveRecitationRecordsSchema.parse({ records: [] }), {
    records: [],
  });
});

test("Recitation records reject invalid marks and unknown fields", () => {
  assert.equal(saveRecitationRecordsSchema.safeParse({
    records: [recitationRecord({ mark: "PRESENT" })],
  }).success, false);
  assert.equal(saveRecitationRecordsSchema.safeParse({
    records: [recitationRecord({ points: 10 })],
  }).success, false);
  assert.equal(createRecitationSessionSchema.safeParse({
    sessionDate: "2026-08-27",
    subjectName: "Client supplied",
  }).success, false);
});

test("Recitation roster validation rejects duplicate students and more than 100 records", () => {
  const duplicate = saveRecitationRecordsSchema.safeParse({
    records: [recitationRecord(), recitationRecord({ mark: "X" })],
  });
  const tooMany = Array.from({ length: 101 }, (_, index) => recitationRecord({
    studentId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  }));

  assert.equal(duplicate.success, false);
  if (!duplicate.success) {
    assert.match(JSON.stringify(duplicate.error.issues), /exactly once/);
  }
  assert.equal(saveRecitationRecordsSchema.safeParse({ records: tooMany }).success, false);
});

test("Recitation parameter schemas accept only UUID identifiers", () => {
  assert.equal(recitationClassIdParamsSchema.safeParse({
    classId: "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0",
  }).success, true);
  assert.equal(recitationClassIdParamsSchema.safeParse({ classId: "class-one" }).success, false);
  assert.equal(recitationSessionIdParamsSchema.safeParse({
    sessionId: "099aa026-ef03-4ab6-92ee-68fa37fb6523",
  }).success, true);
  assert.equal(recitationSessionIdParamsSchema.safeParse({
    sessionId: "session-one",
  }).success, false);
});
