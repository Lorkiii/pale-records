// Provides pure helpers for persisted Attendance sessions, local edits, snapshots, and validation.
import {
  ATTENDANCE_REMARKS_MAX_LENGTH,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_ORDER,
  type AttendanceSessionDraft,
  type AttendanceSessionRecord,
  type AttendanceStatusCode,
  type AttendanceStudentRecord,
  type WorkingAttendanceRecord,
  type WorkingAttendanceRecordsByStudentId,
} from './attendance-types';
import {
  formatDateOnly,
  formatTime,
  type DateFormatPreference,
  type TimeFormatPreference,
} from '../settings/preference-display';

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
// Parses the native date-input value in local time so display labels never shift calendar days.
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

// Sorts the immutable student snapshot by name and optional student number.
function compareAttendanceStudents(
  first: AttendanceStudentRecord,
  second: AttendanceStudentRecord,
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

// Compares working values against the last validated server snapshot.
function areAttendanceRecordsEqual(
  first: WorkingAttendanceRecordsByStudentId,
  second: WorkingAttendanceRecordsByStudentId,
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
      firstRecord.status === secondRecord.status &&
      firstRecord.remarks === secondRecord.remarks,
    );
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

// Copies working containers while retaining real record and student database identifiers.
export function cloneAttendanceRecords(records: WorkingAttendanceRecordsByStudentId) {
  return Object.fromEntries(
    Object.entries(records).map(([studentId, record]) => [
      studentId,
      { ...record, student: { ...record.student } },
    ]),
  );
}

// Confirms that a candidate list contains every roster member exactly once.
export function hasExactAttendanceRoster(
  records: WorkingAttendanceRecordsByStudentId,
  candidateStudentIds: readonly string[],
) {
  const expectedStudentIds = Object.keys(records);
  const uniqueCandidateStudentIds = new Set(candidateStudentIds);

  return expectedStudentIds.length === candidateStudentIds.length &&
    uniqueCandidateStudentIds.size === candidateStudentIds.length &&
    expectedStudentIds.every((studentId) => uniqueCandidateStudentIds.has(studentId));
}

// Counts changed status or remarks values across two working record collections.
export function countAttendanceRecordChanges(
  currentRecords: WorkingAttendanceRecordsByStudentId,
  nextRecords: WorkingAttendanceRecordsByStudentId,
) {
  const studentIds = new Set([
    ...Object.keys(currentRecords),
    ...Object.keys(nextRecords),
  ]);

  return Array.from(studentIds).filter((studentId) => {
    const currentRecord = currentRecords[studentId];
    const nextRecord = nextRecords[studentId];

    return !currentRecord ||
      !nextRecord ||
      currentRecord.status !== nextRecord.status ||
      currentRecord.remarks !== nextRecord.remarks;
  }).length;
}

// Converts a validated persisted session into equal working and last-server snapshots.
export function createAttendanceSessionDraft(
  session: AttendanceSessionRecord,
  defaultAttendanceState?: 'PRESENT' | 'UNRECORDED',
): AttendanceSessionDraft {
  const records = Object.fromEntries(session.records.map((record) => [
    record.student.id,
    {
      id: record.id,
      student: { ...record.student },
      status: !session.isRosterInitialized &&
        defaultAttendanceState === 'PRESENT' &&
        record.status === null
        ? 'P'
        : record.status,
      remarks: record.remarks ?? '',
    },
  ]));

  return {
    id: session.id,
    classId: session.classId,
    classScheduleId: session.classScheduleId,
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    endTime: session.endTime,
    isRosterInitialized: session.isRosterInitialized,
    records,
    savedRecords: cloneAttendanceRecords(records),
  };
}

// Replaces one student's working value without mutating the persisted session draft.
export function updateAttendanceRecord(
  sessionDraft: AttendanceSessionDraft,
  studentId: string,
  record: WorkingAttendanceRecord,
): AttendanceSessionDraft {
  return {
    ...sessionDraft,
    records: {
      ...sessionDraft.records,
      [studentId]: record,
    },
  };
}

// Marks only currently unmarked roster members Present and preserves other values.
export function markUnmarkedAsPresent(sessionDraft: AttendanceSessionDraft) {
  let didChange = false;
  const records = Object.fromEntries(
    Object.entries(sessionDraft.records).map(([studentId, record]) => {
      if (record.status !== null) {
        return [studentId, record];
      }

      didChange = true;
      return [studentId, { ...record, status: 'P' satisfies AttendanceStatusCode }];
    }),
  );

  return didChange ? { ...sessionDraft, records } : sessionDraft;
}

// Returns the selected session's immutable roster snapshot in stable register order.
export function getAttendanceSessionRoster(sessionDraft: AttendanceSessionDraft | undefined) {
  return sessionDraft
    ? Object.values(sessionDraft.records)
      .map((record) => record.student)
      .toSorted(compareAttendanceStudents)
    : [];
}

// Counts the complete selected persisted roster, including records still unmarked.
export function countAttendanceStatuses(
  sessionDraft: AttendanceSessionDraft | undefined,
): AttendanceStatusCounts {
  const counts: AttendanceStatusCounts = {
    P: 0,
    A: 0,
    L: 0,
    E: 0,
    unmarked: 0,
  };

  for (const record of Object.values(sessionDraft?.records ?? {})) {
    if (record.status === null) {
      counts.unmarked += 1;
    } else {
      counts[record.status] += 1;
    }
  }

  return counts;
}

// Reports whether a working record contains an Excused remark.
export function hasExcuseDetails(record: WorkingAttendanceRecord) {
  return record.remarks.trim().length > 0;
}

// Enforces the same Excused-only and maximum-length rules before the network save.
export function validateAttendanceSessionDraft(sessionDraft: AttendanceSessionDraft) {
  const issues: AttendanceValidationIssue[] = [];

  for (const record of Object.values(sessionDraft.records)) {
    const studentName = `${record.student.lastName}, ${record.student.firstName}`;
    const normalizedRemarks = record.remarks.trim();

    if (normalizedRemarks.length > ATTENDANCE_REMARKS_MAX_LENGTH) {
      issues.push({
        studentId: record.student.id,
        message: `${studentName} has remarks longer than ${ATTENDANCE_REMARKS_MAX_LENGTH} characters.`,
      });
    } else if (record.status === 'E' && normalizedRemarks.length === 0) {
      issues.push({
        studentId: record.student.id,
        message: `${studentName} is Excused and requires a remark.`,
      });
    } else if (record.status !== 'E' && normalizedRemarks.length > 0) {
      const currentStatus = record.status
        ? ATTENDANCE_STATUS_LABELS[record.status]
        : 'Unmarked';
      issues.push({
        studentId: record.student.id,
        message: `${studentName} has an Excused remark while ${currentStatus}.`,
      });
    }
  }

  return issues;
}

// Determines whether local working values differ from the last server response.
export function isAttendanceSessionDirty(sessionDraft: AttendanceSessionDraft | undefined) {
  return Boolean(
    sessionDraft &&
    !areAttendanceRecordsEqual(sessionDraft.records, sessionDraft.savedRecords),
  );
}

// Validates a YYYY-MM-DD input without interpreting it as a UTC display timestamp.
export function isAttendanceDateValue(date: string) {
  return parseLocalAttendanceDate(date) !== null;
}

// Formats a complete local calendar label for controls and accessible names.
export function formatAttendanceDateLong(date: string, dateFormat?: DateFormatPreference) {
  return formatDateOnly(date, dateFormat, 'long');
}

// Formats the compact local label used by register and selected-detail headers.
export function formatAttendanceDateShort(date: string, dateFormat?: DateFormatPreference) {
  return formatDateOnly(date, dateFormat, 'short');
}

// Keeps persisted date columns chronological without mutating page state.
export function sortAttendanceSessionDrafts(sessionDrafts: AttendanceSessionDraft[]) {
  return sessionDrafts.toSorted(
    (first, second) => first.sessionDate.localeCompare(second.sessionDate),
  );
}

// Describes whether one historical session matched and snapshotted a weekly schedule.
export function formatAttendanceSessionSchedule(
  sessionDraft: AttendanceSessionDraft,
  timeFormat?: TimeFormatPreference,
) {
  return sessionDraft.startTime && sessionDraft.endTime
    ? `Scheduled / ${formatTime(sessionDraft.startTime, timeFormat, '12H')}–${formatTime(sessionDraft.endTime, timeFormat, '12H')}`
    : 'Unscheduled';
}
