// Provides pure Recitation draft, sorting, mark, count, dirty-state, and date helpers.
import type {
  RecitationMarkCode,
  RecitationSessionDraft,
  RecitationSessionRecord,
  RecitationStudentRecord,
  RecitationUndoSnapshot,
  WorkingRecitationRecordsByStudentId,
} from './recitation-types';

export interface RecitationMarkCounts {
  CHECK: number;
  X: number;
  unmarked: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const ROSTER_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
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

// Compares working marks with the last validated server snapshot.
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
      firstRecord.mark === secondRecord.mark,
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
      mark: record.mark,
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

// Captures the one local snapshot that Undo may restore after the next mark change.
export function createRecitationUndoSnapshot(
  records: WorkingRecitationRecordsByStudentId,
): RecitationUndoSnapshot {
  return cloneRecitationRecords(records);
}

// Returns the next value in the exact Unmarked -> CHECK -> X -> Unmarked cycle.
export function cycleRecitationMark(mark: RecitationMarkCode | null) {
  if (mark === null) {
    return 'CHECK' satisfies RecitationMarkCode;
  }

  return mark === 'CHECK' ? 'X' : null;
}

// Replaces one student's working mark without mutating the selected draft.
export function updateRecitationMark(
  sessionDraft: RecitationSessionDraft,
  studentId: string,
  mark: RecitationMarkCode | null,
): RecitationSessionDraft {
  const currentRecord = sessionDraft.records[studentId];

  if (!currentRecord) {
    return sessionDraft;
  }

  return {
    ...sessionDraft,
    records: {
      ...sessionDraft.records,
      [studentId]: { ...currentRecord, mark },
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

// Counts Check, X, and real null values for the selected complete roster.
export function countRecitationMarks(
  sessionDraft: RecitationSessionDraft | undefined,
): RecitationMarkCounts {
  const counts: RecitationMarkCounts = {
    CHECK: 0,
    X: 0,
    unmarked: 0,
  };

  for (const record of Object.values(sessionDraft?.records ?? {})) {
    if (record.mark === null) {
      counts.unmarked += 1;
    } else {
      counts[record.mark] += 1;
    }
  }

  return counts;
}

// Reports whether working marks differ from the last validated server response.
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
export function formatRecitationDateLong(date: string) {
  const parsedDate = parseLocalRecitationDate(date);
  return parsedDate ? LONG_DATE_FORMATTER.format(parsedDate) : date;
}

// Formats the compact local label used by register date headers.
export function formatRecitationDateShort(date: string) {
  const parsedDate = parseLocalRecitationDate(date);
  return parsedDate ? SHORT_DATE_FORMATTER.format(parsedDate) : date;
}

// Returns the human-readable label for a persisted or local Recitation mark.
export function getRecitationMarkLabel(mark: RecitationMarkCode | null) {
  return mark === 'CHECK' ? 'Check' : mark === 'X' ? 'X' : 'Unmarked';
}
