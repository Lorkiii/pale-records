// Builds date-specific roster models and filenames used by printable Attendance templates.
import type { ClassRecord } from '../classes/class-types';
import { getAttendanceSessionRoster } from './attendance-draft';
import type { AttendanceSessionDraft } from './attendance-types';

export const ATTENDANCE_TEMPLATE_VERSION = '1';

export interface PrintableAttendanceTemplateStudent {
  id: string;
  rowNumber: number;
  name: string;
}

export interface PrintableAttendanceTemplate {
  templateVersion: string;
  templateReference: string;
  attendanceDate: string;
  attendanceDateLabel: string;
  attendanceDateIso: string;
  subject: string;
  subjectCode: string | null;
  section: string | null;
  schoolYearAndSemester: string | null;
  createdBy: string;
  dateCreated: string;
  students: PrintableAttendanceTemplateStudent[];
  filename: string;
}

interface BuildPrintableAttendanceTemplateInput {
  classRecord: ClassRecord;
  session: AttendanceSessionDraft;
  createdBy: string;
  createdAt: Date;
}

const ATTENDANCE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATE_CREATED_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

// Formats the date-only session value without shifting it across time zones.
function formatAttendanceTemplateDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return date;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return ATTENDANCE_DATE_FORMATTER.format(new Date(Date.UTC(year, monthIndex, day)));
}

// Creates a compact non-security fingerprint for later template and roster matching.
function hashAttendanceTemplateIdentity(identity: string) {
  const hash = (seed: number) => {
    let value = seed;
    for (let index = 0; index < identity.length; index += 1) {
      value ^= identity.charCodeAt(index);
      value = Math.imul(value, 16_777_619);
    }
    return (value >>> 0).toString(16).padStart(8, '0');
  };

  return `PALT-${ATTENDANCE_TEMPLATE_VERSION}-${hash(2_166_136_261)}${hash(3_334_154_607)}`
    .toUpperCase();
}

// Returns the stable reference used to reject a template from another class, date, or roster.
export function getAttendanceTemplateReference(session: AttendanceSessionDraft) {
  const rosterIdentity = getAttendanceSessionRoster(session)
    .map((student) => student.id)
    .join('|');
  const templateIdentity = [
    ATTENDANCE_TEMPLATE_VERSION,
    session.classId,
    session.id,
    session.sessionDate,
    rosterIdentity,
  ].join('|');

  return hashAttendanceTemplateIdentity(templateIdentity);
}

// Keeps downloaded template names stable and safe across supported filesystems.
function getAttendanceTemplateClassSlug(classRecord: ClassRecord) {
  const classLabel = classRecord.subjectCode || classRecord.subjectName;
  return classLabel
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'class';
}

// Names a single template as before and gives multi-date bundles an explicit date range.
export function createPrintableAttendanceTemplatesFilename(
  classRecord: ClassRecord,
  attendanceDates: readonly string[],
) {
  const orderedDates = Array.from(new Set(attendanceDates)).toSorted();
  const classSlug = getAttendanceTemplateClassSlug(classRecord);

  if (orderedDates.length <= 1) {
    return `attendance-template_${classSlug}_${orderedDates[0] ?? 'date'}.pdf`;
  }

  return `attendance-templates_${classSlug}_${orderedDates[0]}_to_${orderedDates[orderedDates.length - 1]}.pdf`;
}

// Converts the selected session into a blank, ordered print template without saved marks.
export function buildPrintableAttendanceTemplate({
  classRecord,
  session,
  createdBy,
  createdAt,
}: BuildPrintableAttendanceTemplateInput): PrintableAttendanceTemplate {
  const roster = getAttendanceSessionRoster(session);

  return {
    templateVersion: ATTENDANCE_TEMPLATE_VERSION,
    templateReference: getAttendanceTemplateReference(session),
    attendanceDate: formatAttendanceTemplateDate(session.sessionDate),
    attendanceDateLabel: session.sessionDate.replace(
      /^\d{4}-(\d{2})-(\d{2})$/,
      (_, month, day) => `${Number(month)}/${Number(day)}`,
    ),
    attendanceDateIso: session.sessionDate,
    subject: classRecord.subjectName,
    subjectCode: classRecord.subjectCode,
    section: classRecord.section,
    schoolYearAndSemester: [classRecord.schoolYear, classRecord.semester]
      .filter((value): value is string => Boolean(value))
      .join(' / ') || null,
    createdBy,
    dateCreated: DATE_CREATED_FORMATTER.format(createdAt),
    students: roster.map((student, index) => ({
      id: student.id,
      rowNumber: index + 1,
      name: `${student.lastName}, ${student.firstName}`,
    })),
    filename: createPrintableAttendanceTemplatesFilename(classRecord, [session.sessionDate]),
  };
}
