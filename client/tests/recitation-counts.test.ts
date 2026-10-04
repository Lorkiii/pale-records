// Exercises recitation drafts and API round-trips with local fixtures and no persistent writes.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneRecitationRecords, createRecitationSessionDraft, createRecitationUndoSnapshot,
  getRecitationCountLabel, isRecitationSessionDirty, isValidRecitationCount,
  summarizeRecitations, updateRecitationCount,
} from '../src/features/activity/recitation/recitation-draft';
import { listRecitationSessions, saveRecitationSessionRecords } from '../src/features/activity/recitation/recitation-api';
import type { RecitationSessionRecord } from '../src/features/activity/recitation/recitation-types';

const session: RecitationSessionRecord = {
  id: '099aa026-ef03-4ab6-92ee-68fa37fb6523', classId: '2c6e62cc-584d-4faf-90f6-fdb50b27c9d0',
  sessionDate: '2026-10-04', isRosterInitialized: true,
  records: [0, 3, null].map((count, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    student: { id: `00000000-0000-4000-8000-${String(index + 4).padStart(12, '0')}`, studentNo: null, firstName: 'Test', lastName: String(index) },
    count,
  })),
};
const studentId = session.records[0].student.id;

test('repeated recitations, clear, Undo, and Cancel preserve the saved snapshot', () => {
  const original = createRecitationSessionDraft(session);
  let draft = original;
  for (let count = 1; count <= 6; count += 1) draft = updateRecitationCount(draft, studentId, count);
  const undo = createRecitationUndoSnapshot(draft.records);
  draft = updateRecitationCount(draft, studentId, 0);
  assert.equal(draft.records[studentId].count, 0);
  draft = { ...draft, records: cloneRecitationRecords(undo) };
  assert.equal(draft.records[studentId].count, 6);
  assert.equal(isRecitationSessionDirty(draft), true);
  const canceled = { ...draft, records: cloneRecitationRecords(draft.savedRecords) };
  assert.equal(isRecitationSessionDirty(canceled), false);
  assert.equal(original.records[studentId].count, 0);
  assert.equal(draft.savedRecords[studentId].count, 0);
});

test('blank, unknown, invalid, and exact counts have distinct meanings', () => {
  const draft = createRecitationSessionDraft(session);
  assert.deepEqual(summarizeRecitations(draft), { recited: 2, blank: 1, total: 3, unknown: 1 });
  assert.equal(getRecitationCountLabel(0), 'No recitation');
  assert.match(getRecitationCountLabel(null), /unknown/);
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648, '2']) assert.equal(isValidRecitationCount(value), false);
  assert.equal(updateRecitationCount(draft, studentId, null), draft);
  assert.equal(updateRecitationCount(draft, studentId, -1), draft);
  const corrected = updateRecitationCount(draft, session.records[2].student.id, 4);
  assert.deepEqual(summarizeRecitations(corrected), { recited: 2, blank: 1, total: 7, unknown: 0 });
});

test('saving and retrying sends exact counts and reloading retains them', async (t) => {
  const records = session.records.map((record) => ({ studentId: record.student.id, count: record.count }));
  records[0].count = 5;
  const saved = { ...session, records: session.records.map((record, index) => ({ ...record, count: records[index].count })) };
  const submitted: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    if (options.method === 'PUT') {
      submitted.push(JSON.parse(String(options.body)));
      return new Response(JSON.stringify({ success: true, data: { session: saved } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: { sessions: [saved] } }), { status: 200 });
  });
  assert.deepEqual(await saveRecitationSessionRecords(session, records), saved);
  await saveRecitationSessionRecords(session, records);
  assert.deepEqual(submitted, [{ records }, { records }]);
  const reloaded = await listRecitationSessions(session.classId, 2026, 10, new AbortController().signal);
  assert.equal(reloaded[0].records[0].count, 5);
});

test('failed saves retain the caller snapshot and old mark responses are rejected', async (t) => {
  const draft = updateRecitationCount(createRecitationSessionDraft(session), studentId, 2);
  const records = Object.values(draft.records).map((record) => ({ studentId: record.student.id, count: record.count }));
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, error: { code: 'TEST_ERROR', message: 'Test save failed.' } }), { status: 500 }));
  await assert.rejects(saveRecitationSessionRecords(session, records), /Test save failed/);
  assert.equal(draft.records[studentId].count, 2);
  assert.equal(isRecitationSessionDirty(draft), true);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: true, data: { sessions: [{ ...session, records: session.records.map((record) => ({ ...record, mark: 'CHECK' })) }] } }), { status: 200 }));
  await assert.rejects(listRecitationSessions(session.classId, 2026, 10, new AbortController().signal), /Unable to read/);
});
