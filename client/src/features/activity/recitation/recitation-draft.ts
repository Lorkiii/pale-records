// Provides Recitation count validation, working snapshots, summaries, and date helpers.
import type {
  RecitationCount,
  RecitationSessionDraft,
  RecitationSessionRecord,
  RecitationStudentRecord,
  RecitationUndoSnapshot,
  WorkingRecitationRecordsByStudentId,
} from './recitation-types';
import {
  formatDateOnly,
  type DateFormatPreference,
} from '../../settings/preference-display';

export interface RecitationSummary {
  recited: number;
  blank: number;
  total: number;
  unknown: number;
}

export const MAX_RECITATION_COUNT = 2_147_483_647;

export function isValidRecitationCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_RECITATION_COUNT;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const ROSTER_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
// Parses a date-only value in local time so display labels never shift calendar days.
function parseLocalRecitationDate(date: string) {
  const match = DATE_PATTERN.exec(date);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);

  return parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
    ? parsedDate
    : null;
}

// Orders students by name, optional student number, and stable database identifier.
function compareRecitationStudents(
  first: RecitationStudentRecord,
  second: RecitationStudentRecord,
) {
  const lastNameOrder = ROSTER_COLLATOR.compare(first.lastName, second.lastName);
  if (lastNameOrder !== 0) {
    return lastNameOrder;
  }

  const firstNameOrder = ROSTER_COLLATOR.compare(first.firstName, second.firstName);
  if (firstNameOrder !== 0) {
    return firstNameOrder;
  }

  if (first.studentNo === null) {
    return second.studentNo === null ? first.id.localeCompare(second.id) : 1;
  }

  if (second.studentNo === null) {
    return -1;
  }

  return ROSTER_COLLATOR.compare(first.studentNo, second.studentNo) ||
    first.id.localeCompare(second.id);
}

// Compares working counts with the last validated server snapshot.
function areRecitationRecordsEqual(
  first: WorkingRecitationRecordsByStudentId,
  second: WorkingRecitationRecordsByStudentId,
) {
  const firstIds = Object.keys(first);
  const secondIds = Object.keys(second);

  if (firstIds.length !== secondIds.length) {
    return false;
  }

  return firstIds.every((studentId) => {
    const firstRecord = first[studentId];
    const secondRecord = second[studentId];
    return Boolean(
      firstRecord &&
      secondRecord &&
      firstRecord.id === secondRecord.id &&
      firstRecord.count === secondRecord.count,
    );
  });
}

// Copies working records and nested student identities without shared mutable objects.
export function cloneRecitationRecords(
  records: WorkingRecitationRecordsByStudentId,
) {
  return Object.fromEntries(
    Object.entries(records).map(([studentId, record]) => [
      studentId,
      { ...record, student: { ...record.student } },
    ]),
  );
}

// Converts a validated API session into equal working and last-server snapshots.
export function createRecitationSessionDraft(
  session: RecitationSessionRecord,
): RecitationSessionDraft {
  const records = Object.fromEntries(session.records.map((record) => [
    record.student.id,
    {
      id: record.id,
      student: { ...record.student },
      count: record.count,
    },
  ]));

  return {
    id: session.id,
    classId: session.classId,
    sessionDate: session.sessionDate,
    isRosterInitialized: session.isRosterInitialized,
    records,
    savedRecords: cloneRecitationRecords(records),
  };
}

// Captures the one local snapshot that Undo may restore after the next count change.
export function createRecitationUndoSnapshot(
  records: WorkingRecitationRecordsByStudentId,
): RecitationUndoSnapshot {
  return cloneRecitationRecords(records);
}

// Replaces one count without mutating snapshots or inventing unknown participation.
export function updateRecitationCount(
  sessionDraft: RecitationSessionDraft,
  studentId: string,
  count: RecitationCount,
): RecitationSessionDraft {
  const currentRecord = sessionDraft.records[studentId];

  if (!currentRecord || currentRecord.count === count ||
    (count === null ? currentRecord.count !== null : !isValidRecitationCount(count))) {
    return sessionDraft;
  }

  return {
    ...sessionDraft,
    records: {
      ...sessionDraft.records,
      [studentId]: { ...currentRecord, count },
    },
  };
}

// Returns students in stable register order without mutating the supplied array.
export function sortRecitationStudents(students: RecitationStudentRecord[]) {
  return students.toSorted(compareRecitationStudents);
}

// Extracts the selected session's complete roster in stable register order.
export function getRecitationSessionRoster(
  sessionDraft: RecitationSessionDraft | undefined,
) {
  return sessionDraft
    ? sortRecitationStudents(
      Object.values(sessionDraft.records).map((record) => record.student),
    )
    : [];
}

// Keeps known totals distinct from historical participation with an unknown count.
export function summarizeRecitations(
  sessionDraft: RecitationSessionDraft | undefined,
): RecitationSummary {
  const counts: RecitationSummary = {
    recited: 0,
    blank: 0,
    total: 0,
    unknown: 0,
  };

  for (const record of Object.values(sessionDraft?.records ?? {})) {
    if (record.count === null) {
      counts.recited += 1;
      counts.unknown += 1;
    } else if (record.count === 0) {
      counts.blank += 1;
    } else {
      counts.recited += 1;
      counts.total += record.count;
    }
  }

  return counts;
}

// Reports whether working counts differ from the last validated server response.
export function isRecitationSessionDirty(
  sessionDraft: RecitationSessionDraft | undefined,
) {
  return Boolean(
    sessionDraft &&
    !areRecitationRecordsEqual(sessionDraft.records, sessionDraft.savedRecords),
  );
}

// Keeps Recitation date columns chronological without mutating React state.
export function sortRecitationSessionDrafts(
  sessionDrafts: RecitationSessionDraft[],
) {
  return sessionDrafts.toSorted(
    (first, second) => first.sessionDate.localeCompare(second.sessionDate),
  );
}

// Validates a native date input without applying a UTC display conversion.
export function isRecitationDateValue(date: string) {
  return parseLocalRecitationDate(date) !== null;
}

// Parses the bounded native month value without applying a timezone conversion.
export function getRecitationMonthParts(value: string) {
  const match = MONTH_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
    ? { year, month }
    : null;
}

// Formats a complete local calendar label for notices and accessible names.
export function formatRecitationDateLong(date: string, dateFormat?: DateFormatPreference) {
  return formatDateOnly(date, dateFormat, 'long');
}

// Formats the compact local label used by register date headers.
export function formatRecitationDateShort(date: string, dateFormat?: DateFormatPreference) {
  return formatDateOnly(date, dateFormat, 'short');
}

// Describes blank values and unknown historical counts without implying exact totals.
export function getRecitationCountLabel(count: RecitationCount) {
  return count === null ? 'Recited; count unknown' : count === 0 ? 'No recitation' : `${count} ${count === 1 ? 'recitation' : 'recitations'}`;
}
