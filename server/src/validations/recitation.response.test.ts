// Verifies Recitation responses expose only safe fields and enforce draft and list bounds.
import assert from "node:assert/strict";
import test from "node:test";

import {
  recitationSessionListResponseSchema,
  recitationSessionResponseSchema,
} from "./recitation.response.js";

const sessionId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const studentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

const draftSession = {
  id: sessionId,
  classId,
  sessionDate: "2026-08-27",
  isRosterInitialized: false,
  records: [{
    id: null,
    student: {
      id: studentId,
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
    },
    mark: null,
  }],
};

test("Recitation success response accepts only the documented safe session shape", () => {
  assert.deepEqual(recitationSessionResponseSchema.parse({
    success: true,
    data: { session: draftSession },
  }).data.session, draftSession);

  for (const unsafeSession of [
    { ...draftSession, createdAt: "2026-08-27T00:00:00.000Z" },
    { ...draftSession, sessionDate: "2026-02-30" },
    {
      ...draftSession,
      records: [{ ...draftSession.records[0], points: 10 }],
    },
    {
      ...draftSession,
      records: [{
        ...draftSession.records[0],
        student: { ...draftSession.records[0].student, archivedAt: null },
      }],
    },
  ]) {
    assert.equal(recitationSessionResponseSchema.safeParse({
      success: true,
      data: { session: unsafeSession },
    }).success, false);
  }
});

test("Recitation response distinguishes unpersisted drafts from saved rosters", () => {
  assert.equal(recitationSessionResponseSchema.safeParse({
    success: true,
    data: {
      session: {
        ...draftSession,
        records: [{ ...draftSession.records[0], mark: "CHECK" }],
      },
    },
  }).success, false);
  assert.equal(recitationSessionResponseSchema.safeParse({
    success: true,
    data: {
      session: {
        ...draftSession,
        isRosterInitialized: true,
      },
    },
  }).success, false);
  assert.equal(recitationSessionResponseSchema.safeParse({
    success: true,
    data: {
      session: {
        ...draftSession,
        isRosterInitialized: true,
        records: [{
          ...draftSession.records[0],
          id: "6fd5133c-0985-49a2-b3dc-10a3b03110de",
          mark: "X",
        }],
      },
    },
  }).success, true);
});

test("Recitation monthly response rejects more than 31 sessions", () => {
  const sessions = Array.from({ length: 32 }, (_, index) => ({
    ...draftSession,
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    records: [],
  }));

  assert.equal(recitationSessionListResponseSchema.safeParse({
    success: true,
    data: { sessions },
  }).success, false);
});
