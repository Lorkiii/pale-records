// Verifies archived deletion guards cover every saved class and student history relation.
import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteArchivedClass,
  canDeleteArchivedStudent,
  deleteEligibleArchivedClasses,
  deleteEligibleArchivedStudents,
} from "./archive-management.service.js";

const emptyClassHistory = {
  attendanceSessions: 0,
  attendanceMonthGenerations: 0,
  recitationSessions: 0,
  agendaEvents: 0,
};

test("class deletion blocks every saved history relation", () => {
  assert.equal(canDeleteArchivedClass(emptyClassHistory), true);
  for (const relation of Object.keys(emptyClassHistory) as Array<keyof typeof emptyClassHistory>) {
    assert.equal(canDeleteArchivedClass({ ...emptyClassHistory, [relation]: 1 }), false);
  }
});

test("student deletion blocks attendance and recitation records", () => {
  assert.equal(canDeleteArchivedStudent({ attendanceRecords: 0, recitationRecords: 0 }), true);
  assert.equal(canDeleteArchivedStudent({ attendanceRecords: 1, recitationRecords: 0 }), false);
  assert.equal(canDeleteArchivedStudent({ attendanceRecords: 0, recitationRecords: 1 }), false);
});

const firstId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const secondId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

test("class batches delete none when one class has history or is no longer archived", async () => {
  let deleteCalls = 0;
  const protectedResult = await deleteEligibleArchivedClasses([firstId, secondId], {
    find: async () => [
      { id: firstId, _count: emptyClassHistory },
      { id: secondId, _count: { ...emptyClassHistory, agendaEvents: 1 } },
    ],
    delete: async () => { deleteCalls += 1; return 2; },
  });
  assert.deepEqual(protectedResult, { status: "protected", blockedIds: [secondId] });
  assert.equal(deleteCalls, 0);

  const staleResult = await deleteEligibleArchivedClasses([firstId, secondId], {
    find: async () => [{ id: firstId, _count: emptyClassHistory }],
    delete: async () => { deleteCalls += 1; return 2; },
  });
  assert.deepEqual(staleResult, { status: "selection_changed" });
  assert.equal(deleteCalls, 0);
});

test("eligible class batches require the exact delete count", async () => {
  const store = {
    find: async () => [
      { id: firstId, _count: emptyClassHistory },
      { id: secondId, _count: emptyClassHistory },
    ],
    delete: async () => 2,
  };
  assert.deepEqual(await deleteEligibleArchivedClasses([firstId, secondId], store), {
    status: "deleted", deletedIds: [firstId, secondId],
  });
  await assert.rejects(() => deleteEligibleArchivedClasses([firstId, secondId], {
    ...store,
    delete: async () => 1,
  }));
});

test("student batches delete none when one student has saved attendance", async () => {
  let deleted = false;
  const result = await deleteEligibleArchivedStudents([firstId, secondId], {
    find: async () => [
      { id: firstId, _count: { attendanceRecords: 0, recitationRecords: 0 } },
      { id: secondId, _count: { attendanceRecords: 1, recitationRecords: 0 } },
    ],
    delete: async () => { deleted = true; return 2; },
  });
  assert.deepEqual(result, { status: "protected", blockedIds: [secondId] });
  assert.equal(deleted, false);
});
