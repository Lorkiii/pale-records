// Provides pure helpers for page-memory attendance dates, rosters, updates, and validation.
import type { StudentRecord } from '../students/student-types';
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_ORDER,
  type AttendanceDateDraft,
  type AttendanceDraftRecord,
  type AttendanceRecordsByStudentId,
  type AttendanceStatusCode,
} from './attendance-types';

export interface AttendanceStatusCounts {
  P: number;
  A: number;
  L: number;
  E: number;
  unmarked: number;
}

export interface AttendanceValidationIssue {
  studentId: string;
  message: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
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

// Parses the native date-input value in local time so calendar labels never shift through UTC.
function parseLocalAttendanceDate(date: string) {
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

// Returns a fresh unmarked record so rows never share mutable page state.
function createEmptyAttendanceRecord(): AttendanceDraftRecord {
  return {
    status: null,
    remarks: '',
    proof: null,
  };
}

// Compares local File-backed records without serializing or dropping the original File object.
function areAttendanceRecordsEqual(
  first: AttendanceRecordsByStudentId,
  second: AttendanceRecordsByStudentId,
) {
  const firstIds = Object.keys(first);
  const secondIds = Object.keys(second);

  if (firstIds.length !== secondIds.length) {
    return false;
  }

  return firstIds.every((studentId) => {
    const firstRecord = first[studentId];
    const secondRecord = second[studentId];

    if (!firstRecord || !secondRecord) {
      return false;
    }

    return firstRecord.status === secondRecord.status &&
      firstRecord.remarks === secondRecord.remarks &&
      firstRecord.proof?.file === secondRecord.proof?.file &&
      firstRecord.proof?.name === secondRecord.proof?.name &&
      firstRecord.proof?.type === secondRecord.proof?.type &&
      firstRecord.proof?.size === secondRecord.proof?.size;
  });
}

// Returns the next code in the exact Unmarked -> P -> A -> L -> E -> P cycle.
export function cycleAttendanceStatus(status: AttendanceStatusCode | null) {
  if (status === null) {
    return ATTENDANCE_STATUS_ORDER[0];
  }

  const currentIndex = ATTENDANCE_STATUS_ORDER.indexOf(status);
  return ATTENDANCE_STATUS_ORDER[(currentIndex + 1) % ATTENDANCE_STATUS_ORDER.length];
}

// Filters the saved directory by enrollment and applies the register's stable identity order.
export function filterAndSortRoster(students: StudentRecord[], classId: string) {
  return students
    .filter((student) => student.classes.some((classRecord) => classRecord.id === classId))
    .toSorted((first, second) => {
      const lastNameOrder = ROSTER_COLLATOR.compare(first.lastName, second.lastName);
      if (lastNameOrder !== 0) {
        return lastNameOrder;
      }

      const firstNameOrder = ROSTER_COLLATOR.compare(first.firstName, second.firstName);
      if (firstNameOrder !== 0) {
        return firstNameOrder;
      }

      if (first.studentNo === null) {
        return second.studentNo === null ? 0 : 1;
      }

      if (second.studentNo === null) {
        return -1;
      }

      return ROSTER_COLLATOR.compare(first.studentNo, second.studentNo);
    });
}

// Creates the first unsaved working copy for one class roster and calendar date.
export function createAttendanceDateDraft(
  date: string,
  roster: StudentRecord[],
): AttendanceDateDraft {
  return {
    date,
    records: Object.fromEntries(
      roster.map((student) => [student.id, createEmptyAttendanceRecord()]),
    ),
    savedRecords: null,
  };
}

// Copies the record containers while intentionally retaining each page-memory File reference.
export function cloneAttendanceRecords(records: AttendanceRecordsByStudentId) {
  return Object.fromEntries(
    Object.entries(records).map(([studentId, record]) => [
      studentId,
      { ...record, proof: record.proof ? { ...record.proof } : null },
    ]),
  );
}

// Replaces one student's working record without mutating the selected date draft.
export function updateAttendanceRecord(
  dateDraft: AttendanceDateDraft,
  studentId: string,
  record: AttendanceDraftRecord,
): AttendanceDateDraft {
  return {
    ...dateDraft,
    records: {
      ...dateDraft.records,
      [studentId]: record,
    },
  };
}

// Marks only currently unmarked roster members Present and preserves every other status.
export function markUnmarkedAsPresent(dateDraft: AttendanceDateDraft) {
  let didChange = false;
  const records = Object.fromEntries(
    Object.entries(dateDraft.records).map(([studentId, record]) => {
      if (record.status !== null) {
        return [studentId, record];
      }

      didChange = true;
      return [studentId, { ...record, status: 'P' satisfies AttendanceStatusCode }];
    }),
  );

  return didChange ? { ...dateDraft, records } : dateDraft;
}

// Counts the actual selected roster, including students that remain unmarked.
export function countAttendanceStatuses(
  dateDraft: AttendanceDateDraft | undefined,
  roster: StudentRecord[],
): AttendanceStatusCounts {
  const counts: AttendanceStatusCounts = {
    P: 0,
    A: 0,
    L: 0,
    E: 0,
    unmarked: 0,
  };

  for (const student of roster) {
    const status = dateDraft?.records[student.id]?.status ?? null;
    if (status === null) {
      counts.unmarked += 1;
    } else {
      counts[status] += 1;
    }
  }

  return counts;
}

// Reports whether a record contains page-memory excuse information regardless of status.
export function hasExcuseDetails(record: AttendanceDraftRecord) {
  return record.remarks.trim().length > 0 || record.proof !== null;
}

// Blocks saves that omit Excused remarks or leave preserved details on another status.
export function validateAttendanceDateDraft(
  dateDraft: AttendanceDateDraft,
  roster: StudentRecord[],
) {
  const issues: AttendanceValidationIssue[] = [];

  for (const student of roster) {
    const record = dateDraft.records[student.id] ?? createEmptyAttendanceRecord();
    const studentName = `${student.lastName}, ${student.firstName}`;

    if (record.status === 'E' && record.remarks.trim().length === 0) {
      issues.push({
        studentId: student.id,
        message: `${studentName} is Excused and requires a remark.`,
      });
    } else if (record.status !== 'E' && hasExcuseDetails(record)) {
      const currentStatus = record.status
        ? ATTENDANCE_STATUS_LABELS[record.status]
        : 'Unmarked';
      issues.push({
        studentId: student.id,
        message: `${studentName} has excuse details while ${currentStatus}. Return the status to Excused or remove the details.`,
      });
    }
  }

  return issues;
}

// Determines whether the working date differs from its last page-memory save.
export function isAttendanceDateDirty(dateDraft: AttendanceDateDraft | undefined) {
  if (!dateDraft) {
    return false;
  }

  return dateDraft.savedRecords === null ||
    !areAttendanceRecordsEqual(dateDraft.records, dateDraft.savedRecords);
}

// Validates a YYYY-MM-DD input without interpreting it as a UTC timestamp.
export function isAttendanceDateValue(date: string) {
  return parseLocalAttendanceDate(date) !== null;
}

// Formats a complete local calendar label for controls and accessible names.
export function formatAttendanceDateLong(date: string) {
  const parsedDate = parseLocalAttendanceDate(date);
  return parsedDate ? LONG_DATE_FORMATTER.format(parsedDate) : date;
}

// Formats the compact local label used by register and selected-detail headers.
export function formatAttendanceDateShort(date: string) {
  const parsedDate = parseLocalAttendanceDate(date);
  return parsedDate ? SHORT_DATE_FORMATTER.format(parsedDate) : date;
}

// Keeps date columns in chronological YYYY-MM-DD order without mutating page state.
export function sortAttendanceDateDrafts(dateDrafts: AttendanceDateDraft[]) {
  return dateDrafts.toSorted((first, second) => first.date.localeCompare(second.date));
}

// Presents selected proof sizes without imposing a fictional upload limit.
export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
