// Builds one truthful, saved-data monthly Attendance report for file exporters.
import type { ClassRecord } from '../classes/class-types';
import type {
  AttendanceSessionDraft,
  AttendanceStatusCode,
  AttendanceStudentRecord,
} from './attendance-types';

export interface AttendanceReportDate {
  id: string;
  label: string;
  isSaved: boolean;
}

export interface AttendanceReportStudentRow {
  id: string;
  name: string;
  statusByDateId: Record<string, AttendanceStatusCode | null>;
  remarkByDateId: Record<string, string>;
}

export interface MonthlyAttendanceReport {
  monthYear: string;
  subject: string;
  subjectCode: string | null;
  schoolYearAndSemester: string | null;
  createdBy: string;
  dateCreated: string;
  dates: AttendanceReportDate[];
  students: AttendanceReportStudentRow[];
  unsavedDateLabels: string[];
  excludesUnsavedEdits: boolean;
  filename: string;
}

interface BuildMonthlyAttendanceReportInput {
  classRecord: ClassRecord;
  monthInput: string;
  sessions: AttendanceSessionDraft[];
  createdBy: string;
  createdAt: Date;
  hasUnsavedChanges: boolean;
}

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATE_CREATED_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

// Formats a date-only value as the compact month/day column requested for reports.
export function formatAttendanceReportDate(date: string) {
  const [, , month = '', day = ''] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

// Formats the selected YYYY-MM value without a browser timezone shift.
export function formatAttendanceReportMonth(monthInput: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthInput);
  if (!match) {
    return monthInput;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return MONTH_YEAR_FORMATTER.format(new Date(Date.UTC(year, monthIndex, 1)));
}

// Creates a stable, filesystem-safe report name from real class and month fields.
function createAttendanceReportFilename(classRecord: ClassRecord, monthInput: string) {
  const classLabel = classRecord.subjectCode || classRecord.subjectName;
  const safeClassLabel = classLabel
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'class';

  return `attendance_${safeClassLabel}_${monthInput}.pdf`;
}

// Orders report identities consistently even when monthly historical rosters differ.
function compareAttendanceStudents(
  first: AttendanceStudentRecord,
  second: AttendanceStudentRecord,
) {
  return first.lastName.localeCompare(second.lastName) ||
    first.firstName.localeCompare(second.firstName) ||
    first.id.localeCompare(second.id);
}

// Converts loaded session snapshots into the shared matrix used by PDF export.
export function buildMonthlyAttendanceReport({
  classRecord,
  monthInput,
  sessions,
  createdBy,
  createdAt,
  hasUnsavedChanges,
}: BuildMonthlyAttendanceReportInput): MonthlyAttendanceReport {
  const orderedSessions = [...sessions].sort(
    (first, second) => first.sessionDate.localeCompare(second.sessionDate) ||
      first.id.localeCompare(second.id),
  );
  const studentsById = new Map<string, AttendanceStudentRecord>();

  for (const session of orderedSessions) {
    for (const record of Object.values(session.savedRecords)) {
      studentsById.set(record.student.id, record.student);
    }
  }

  const dates = orderedSessions.map((session) => ({
    id: session.id,
    label: formatAttendanceReportDate(session.sessionDate),
    isSaved: session.isRosterInitialized,
  }));
  const students = [...studentsById.values()]
    .sort(compareAttendanceStudents)
    .map((student) => ({
      id: student.id,
      name: `${student.lastName}, ${student.firstName}`,
      statusByDateId: Object.fromEntries(
        orderedSessions.map((session) => [
          session.id,
          session.savedRecords[student.id]?.status ?? null,
        ]),
      ),
      remarkByDateId: Object.fromEntries(
        orderedSessions.map((session) => [
          session.id,
          session.savedRecords[student.id]?.remarks.trim() ?? '',
        ]),
      ),
    }));
  const schoolYearAndSemester = [classRecord.schoolYear, classRecord.semester]
    .filter((value): value is string => Boolean(value))
    .join(' / ') || null;

  return {
    monthYear: formatAttendanceReportMonth(monthInput),
    subject: classRecord.subjectName,
    subjectCode: classRecord.subjectCode,
    schoolYearAndSemester,
    createdBy,
    dateCreated: DATE_CREATED_FORMATTER.format(createdAt),
    dates,
    students,
    unsavedDateLabels: dates
      .filter((date) => !date.isSaved)
      .map((date) => date.label),
    excludesUnsavedEdits: hasUnsavedChanges,
    filename: createAttendanceReportFilename(classRecord, monthInput),
  };
}
