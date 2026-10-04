// Verifies manual Recitation drafts, date-bounded lists, and immutable historical roster saves.
import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/db-client.js";

import {
  createRecitationSession,
  deleteRecitationSession,
  hasExactRecitationStudentSet,
  listRecitationSessions,
  loadRecitationSession,
  RecitationSessionConflictError,
  saveRecitationRecords,
  type RecitationServiceDependencies,
  canPreserveUnknownRecitationCounts,
} from "./recitation.service.js";

const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const sessionId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const firstStudentId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const secondStudentId = "1d7f6a68-01d8-4abe-9f17-c3d03ed4ad86";
const extraStudentId = "e1003b44-b8b0-47eb-bdc3-cb6936ce0f4c";

const firstStudent = {
  id: firstStudentId,
  studentNo: "AB-123",
  firstName: "Ana",
  lastName: "Reyes",
};

const secondStudent = {
  id: secondStudentId,
  studentNo: null,
  firstName: "Ben",
  lastName: "Cruz",
};

const extraStudent = {
  id: extraStudentId,
  studentNo: "AB-125",
  firstName: "Cara",
  lastName: "Diaz",
};

const currentEnrollments = [firstStudent, secondStudent].map((student) => ({ student }));

const storedSession = {
  id: sessionId,
  classId,
  sessionDate: new Date("2026-08-27T00:00:00.000Z"),
  rosterInitializedAt: new Date("2026-08-27T12:00:00.000Z"),
  recitationRecords: [
    {
      id: "6fd5133c-0985-49a2-b3dc-10a3b03110de",
      studentId: firstStudentId,
      student: firstStudent,
      count: 3,
    },
    {
      id: "e7d59d7b-ae0c-49ae-8512-3f9fcdb457ae",
      studentId: secondStudentId,
      student: secondStudent,
      count: 0,
    },
  ],
  class: { enrollments: currentEnrollments },
};

const draftSession = {
  ...storedSession,
  rosterInitializedAt: null,
  recitationRecords: [] as typeof storedSession.recitationRecords,
};

// Creates deterministic service fakes while allowing one database behavior to vary.
function createDependencies(
  overrides: Partial<RecitationServiceDependencies> = {},
): RecitationServiceDependencies {
  return {
    findClassSnapshot: async () => ({ archivedAt: null }),
    insertSession: async () => draftSession,
    findClassSessions: async () => ({ recitationSessions: [] }),
    findSession: async () => storedSession,
    deleteSession: async () => true,
    saveSessionRecords: async () => ({ status: "saved", session: storedSession }),
    ...overrides,
  };
}

test("Recitation creation persists a UTC date-only session without record rows", async () => {
  let receivedDate: Date | undefined;
  const result = await createRecitationSession(
    classId,
    "2026-08-27",
    createDependencies({
      insertSession: async (_classId, sessionDate) => {
        receivedDate = sessionDate;
        return { ...draftSession, sessionDate };
      },
    }),
  );

  assert.equal(receivedDate?.toISOString(), "2026-08-27T00:00:00.000Z");
  assert.equal(draftSession.recitationRecords.length, 0);
  assert.equal(result.status, "created");
  if (result.status === "created") {
    assert.equal(result.session.sessionDate, "2026-08-27");
    assert.equal(result.session.isRosterInitialized, false);
    assert.equal(result.session.records.every((record) => record.id === null), true);
  }
  assert.equal(draftSession.recitationRecords.length, 0);
});

test("Recitation creation returns safe missing, archived, and duplicate outcomes", async () => {
  const missing = await createRecitationSession(classId, "2026-08-27", createDependencies({
    findClassSnapshot: async () => null,
  }));
  const archived = await createRecitationSession(classId, "2026-08-27", createDependencies({
    findClassSnapshot: async () => ({ archivedAt: new Date("2026-08-26T00:00:00.000Z") }),
  }));
  const duplicate = await createRecitationSession(classId, "2026-08-27", createDependencies({
    insertSession: async () => {
      throw new RecitationSessionConflictError();
    },
  }));

  assert.deepEqual(missing, { status: "class_not_found" });
  assert.deepEqual(archived, { status: "class_archived" });
  assert.deepEqual(duplicate, { status: "session_exists" });
});

test("monthly Recitation listing uses UTC month bounds, caps results, and checks class existence", async () => {
  let receivedBounds: [Date, Date] | undefined;
  const sessions = Array.from({ length: 32 }, (_, index) => ({
    ...draftSession,
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  }));
  const found = await listRecitationSessions(classId, 2026, 8, createDependencies({
    findClassSessions: async (_classId, monthStart, nextMonthStart) => {
      receivedBounds = [monthStart, nextMonthStart];
      return { recitationSessions: sessions };
    },
  }));
  const missing = await listRecitationSessions(classId, 2026, 8, createDependencies({
    findClassSessions: async () => null,
  }));

  assert.deepEqual(receivedBounds?.map((date) => date.toISOString()), [
    "2026-08-01T00:00:00.000Z",
    "2026-09-01T00:00:00.000Z",
  ]);
  assert.equal(found.status === "found" && found.sessions.length, 31);
  assert.deepEqual(missing, { status: "class_not_found" });
});

test("loading an uninitialized session returns current enrollment as an unpersisted blank draft", async () => {
  const source = { ...draftSession, recitationRecords: [] };
  const loaded = await loadRecitationSession(sessionId, createDependencies({
    findSession: async () => source,
  }));

  assert.equal(source.recitationRecords.length, 0);
  assert.equal(loaded?.isRosterInitialized, false);
  assert.deepEqual(loaded?.records.map((record) => ({
    id: record.id,
    studentId: record.student.id,
    count: record.count,
  })), [
    { id: null, studentId: secondStudentId, count: 0 },
    { id: null, studentId: firstStudentId, count: 0 },
  ]);
  assert.equal(source.recitationRecords.length, 0);
});

test("Recitation deletion returns the exact persisted-session outcome", async () => {
  const deleted = await deleteRecitationSession(sessionId, createDependencies());
  const missing = await deleteRecitationSession(sessionId, createDependencies({
    deleteSession: async () => false,
  }));

  assert.equal(deleted, true);
  assert.equal(missing, false);
});

test("first save writes the complete roster including blank counts", async () => {
  let receivedRecords:
    | Parameters<RecitationServiceDependencies["saveSessionRecords"]>[1]
    | undefined;
  const result = await saveRecitationRecords(
    sessionId,
    [
      { studentId: firstStudentId, count: 3 },
      { studentId: secondStudentId, count: 0 },
    ],
    createDependencies({
      saveSessionRecords: async (_sessionId, records) => {
        receivedRecords = records;
        return { status: "saved", session: storedSession };
      },
    }),
  );

  assert.deepEqual(receivedRecords, [
    { studentId: firstStudentId, count: 3 },
    { studentId: secondStudentId, count: 0 },
  ]);
  assert.equal(result.status, "saved");
  if (result.status === "saved") {
    assert.equal(result.session.isRosterInitialized, true);
    assert.equal(result.session.records.every((record) => record.id !== null), true);
  }
});

test("enrollment changes affect drafts but never a saved historical Recitation roster", async () => {
  const enrollmentState = [...currentEnrollments, { student: extraStudent }];
  const unsaved = {
    ...draftSession,
    class: { enrollments: enrollmentState },
  };
  const saved = {
    ...storedSession,
    class: { enrollments: enrollmentState },
  };

  const unsavedLoaded = await loadRecitationSession(sessionId, createDependencies({
    findSession: async () => unsaved,
  }));
  const savedLoaded = await loadRecitationSession(sessionId, createDependencies({
    findSession: async () => saved,
  }));

  assert.deepEqual(
    unsavedLoaded?.records.map((record) => record.student.id).sort(),
    [firstStudentId, secondStudentId, extraStudentId].sort(),
  );
  assert.deepEqual(
    savedLoaded?.records.map((record) => record.student.id).sort(),
    [firstStudentId, secondStudentId].sort(),
  );
});

test("later saves update only the stored roster and preserve its student identities", async () => {
  let submittedStudentIds: string[] = [];
  const result = await saveRecitationRecords(
    sessionId,
    [
      { studentId: firstStudentId, count: 0 },
      { studentId: secondStudentId, count: 3 },
    ],
    createDependencies({
      saveSessionRecords: async (_sessionId, records) => {
        submittedStudentIds = records.map((record) => record.studentId);
        return {
          status: "saved",
          session: {
            ...storedSession,
            class: { enrollments: [...currentEnrollments, { student: extraStudent }] },
            recitationRecords: storedSession.recitationRecords.map((record) => ({
              ...record,
              count: record.studentId === firstStudentId
                ? 0
                : 3,
            })),
          },
        };
      },
    }),
  );

  assert.deepEqual(submittedStudentIds.sort(), [firstStudentId, secondStudentId].sort());
  assert.equal(result.status, "saved");
  if (result.status === "saved") {
    assert.deepEqual(
      result.session.records.map((record) => record.student.id).sort(),
      [firstStudentId, secondStudentId].sort(),
    );
  }
});

test("duplicate, missing, and extra submitted students are rejected", async () => {
  let duplicateReachedDatabase = false;
  const duplicate = await saveRecitationRecords(sessionId, [
    { studentId: firstStudentId, count: 3 },
    { studentId: firstStudentId, count: 0 },
  ], createDependencies({
    saveSessionRecords: async () => {
      duplicateReachedDatabase = true;
      return { status: "saved", session: storedSession };
    },
  }));

  const mismatchDependencies = createDependencies({
    saveSessionRecords: async (_sessionId, records) => {
      const isExactRoster = hasExactRecitationStudentSet(
        [firstStudentId, secondStudentId],
        records.map((record) => record.studentId),
      );
      return isExactRoster
        ? { status: "saved", session: storedSession }
        : { status: "roster_mismatch" };
    },
  });
  const missing = await saveRecitationRecords(sessionId, [
    { studentId: firstStudentId, count: 0 },
  ], mismatchDependencies);
  const extra = await saveRecitationRecords(sessionId, [
    { studentId: firstStudentId, count: 0 },
    { studentId: secondStudentId, count: 0 },
    { studentId: extraStudentId, count: 0 },
  ], mismatchDependencies);

  assert.deepEqual(duplicate, { status: "student_duplicate" });
  assert.equal(duplicateReachedDatabase, false);
  assert.deepEqual(missing, { status: "roster_mismatch" });
  assert.deepEqual(extra, { status: "roster_mismatch" });
});

test("genuine empty rosters initialize and remain saveable", async () => {
  const emptyStoredSession = {
    ...storedSession,
    recitationRecords: [],
    class: { enrollments: [] },
  };
  let saveCalls = 0;
  const result = await saveRecitationRecords(sessionId, [], createDependencies({
    saveSessionRecords: async (_sessionId, records) => {
      saveCalls += 1;
      assert.deepEqual(records, []);
      return { status: "saved", session: emptyStoredSession };
    },
  }));

  assert.equal(saveCalls, 1);
  assert.equal(result.status, "saved");
  if (result.status === "saved") {
    assert.equal(result.session.isRosterInitialized, true);
    assert.deepEqual(result.session.records, []);
  }
});

test("concurrent first saves create one historical roster and both return safely", async () => {
  const historicalRecords = new Map<string, number | null>();
  let initializationCount = 0;
  let initialized = false;
  let releasePrevious = Promise.resolve();

  const concurrentDependencies = createDependencies({
    saveSessionRecords: async (_sessionId, records) => {
      const previous = releasePrevious;
      let releaseCurrent: (() => void) | undefined;
      releasePrevious = new Promise<void>((resolve) => {
        releaseCurrent = resolve;
      });
      await previous;

      try {
        const studentIds = records.map((record) => record.studentId);
        const expectedIds = initialized
          ? [...historicalRecords.keys()]
          : [firstStudentId, secondStudentId];
        if (!hasExactRecitationStudentSet(expectedIds, studentIds)) {
          return { status: "roster_mismatch" };
        }

        if (!initialized) {
          initialized = true;
          initializationCount += 1;
        }
        for (const record of records) {
          historicalRecords.set(record.studentId, record.count);
        }

        return {
          status: "saved",
          session: {
            ...storedSession,
            recitationRecords: storedSession.recitationRecords.map((record) => ({
              ...record,
              count: historicalRecords.get(record.studentId) ?? 0,
            })),
          },
        };
      } finally {
        releaseCurrent?.();
      }
    },
  });

  const [first, second] = await Promise.all([
    saveRecitationRecords(sessionId, [
      { studentId: firstStudentId, count: 3 },
      { studentId: secondStudentId, count: 0 },
    ], concurrentDependencies),
    saveRecitationRecords(sessionId, [
      { studentId: firstStudentId, count: 0 },
      { studentId: secondStudentId, count: 3 },
    ], concurrentDependencies),
  ]);

  assert.equal(first.status, "saved");
  assert.equal(second.status, "saved");
  assert.equal(initializationCount, 1);
  assert.equal(historicalRecords.size, 2);
});

test("missing Recitation sessions remain safe", async () => {
  const missingLoad = await loadRecitationSession(sessionId, createDependencies({
    findSession: async () => null,
  }));
  const missingSave = await saveRecitationRecords(sessionId, [], createDependencies({
    saveSessionRecords: async () => ({ status: "session_not_found" }),
  }));

  assert.equal(missingLoad, null);
  assert.deepEqual(missingSave, { status: "session_not_found" });

});

test("historical Checks remain unknown until an exact count is entered", async () => {
  const loaded = await loadRecitationSession(sessionId, createDependencies({
    findSession: async () => ({
      ...storedSession,
      recitationRecords: storedSession.recitationRecords.map((record) => ({ ...record, count: null })),
    }),
  }));
  assert.equal(loaded?.records.every((record) => record.count === null), true);
});

test("unknown counts may be preserved only for their existing historical students", () => {
  const unknown = [{ studentId: firstStudentId, count: null }];
  const known = [{ studentId: firstStudentId, count: 3 }];
  assert.equal(canPreserveUnknownRecitationCounts(unknown, []), false);
  assert.equal(canPreserveUnknownRecitationCounts(unknown, known), false);
  assert.equal(canPreserveUnknownRecitationCounts(unknown, unknown), true);
  assert.equal(canPreserveUnknownRecitationCounts(known, unknown), true);
  assert.equal(canPreserveUnknownRecitationCounts([{ studentId: secondStudentId, count: null }], unknown), false);
});

test("transaction saves preserve unknown counts without writing null and reject invented unknowns", async (t) => {
  let isDraft = false;
  let countsKnown = false;
  let recordWrites = 0;
  const transaction = {
    recitationSession: {
      findUnique: async () => isDraft ? draftSession : {
        ...storedSession,
        recitationRecords: storedSession.recitationRecords.map((record) => ({ ...record, count: countsKnown ? record.count : null })),
      },
      updateMany: async () => ({ count: 1 }),
    },
    studentEnrollment: { findMany: async () => [firstStudentId, secondStudentId].map((studentId) => ({ studentId })) },
    recitationRecord: {
      createMany: async () => { recordWrites += 1; },
      update: async () => { recordWrites += 1; },
    },
  };
  // Prisma exposes a callable proxy property whose descriptor has no method value.
  const originalTransaction = prisma.$transaction;
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (callback: unknown) => {
      if (typeof callback !== "function") throw new Error("Expected interactive transaction");
      return callback(transaction);
    },
  });
  t.after(() => Object.defineProperty(prisma, "$transaction", { value: originalTransaction }));
  const records = [firstStudentId, secondStudentId].map((studentId) => ({ studentId, count: null }));
  assert.equal((await saveRecitationRecords(sessionId, records)).status, "saved");
  assert.equal(recordWrites, 0);
  countsKnown = true;
  assert.equal((await saveRecitationRecords(sessionId, records)).status, "count_invalid");
  isDraft = true;
  assert.equal((await saveRecitationRecords(sessionId, records)).status, "count_invalid");
  assert.equal(recordWrites, 0);
});
