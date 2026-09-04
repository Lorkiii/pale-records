// Builds and validates date-specific PALE Attendance CSV templates in browser memory.
import type { ClassRecord } from '../classes/class-types';
import { escapeAttendanceCsvField } from './attendance-csv-field';
import { getAttendanceSessionRoster } from './attendance-draft';
import {
  ATTENDANCE_REMARKS_MAX_LENGTH,
  isAttendanceStatusCode,
  type AttendanceSessionDraft,
  type AttendanceStatusCode,
  type WorkingAttendanceRecordsByStudentId,
} from './attendance-types';

export const ATTENDANCE_IMPORT_MAX_FILE_SIZE_BYTES = 256 * 1024;

const TEMPLATE_NAME = 'PALE Attendance Import';
const TEMPLATE_VERSION = '1';
const STUDENT_HEADERS = [
  'Student ID',
  'Student Number',
  'Last Name',
  'First Name',
  'PALE Status',
  'Remarks',
] as const;

export interface AttendanceImportChangedRow {
  studentId: string;
  studentName: string;
  previousStatus: AttendanceStatusCode | null;
  nextStatus: AttendanceStatusCode | null;
  previousRemarks: string;
  nextRemarks: string;
}

export interface AttendanceImportPreview {
  records: WorkingAttendanceRecordsByStudentId;
  changedRows: AttendanceImportChangedRow[];
}

export class AttendanceImportValidationError extends Error {
  messages: string[];

  constructor(messages: string[]) {
    super(messages[0] ?? 'The attendance CSV is invalid.');
    this.name = 'AttendanceImportValidationError';
    this.messages = messages;
  }
}

// Restores only the leading apostrophe added by PALE's spreadsheet-formula protection.
function restoreSpreadsheetSafeField(value: string) {
  if (!value.startsWith("'")) {
    return value;
  }

  const originalValue = value.slice(1);
  const trimmedValue = originalValue.trimStart();
  return /^[=+@]/.test(trimmedValue) || /^-(?=.)/.test(trimmedValue)
    ? originalValue
    : value;
}

// Formats the same concise class identity in the template and import validation.
function getAttendanceImportClassLabel(classRecord: ClassRecord) {
  const identity = classRecord.subjectCode?.trim()
    ? `${classRecord.subjectCode.trim()} — ${classRecord.subjectName}`
    : classRecord.subjectName;
  return classRecord.section?.trim()
    ? `${identity} / ${classRecord.section.trim()}`
    : identity;
}

// Serializes a complete selected-date roster using stable database identifiers.
export function createAttendanceImportCsv(
  classRecord: ClassRecord,
  session: AttendanceSessionDraft,
) {
  const rows: string[][] = [
    [TEMPLATE_NAME, TEMPLATE_VERSION],
    ['Class ID', session.classId],
    ['Class', getAttendanceImportClassLabel(classRecord)],
    ['Session ID', session.id],
    // Keeps spreadsheet applications from rewriting the ISO date on save.
    ['Attendance Date', `DATE:${session.sessionDate}`],
    [],
    [...STUDENT_HEADERS],
    ...getAttendanceSessionRoster(session).map((student) => {
      const record = session.records[student.id];
      return [
        student.id,
        student.studentNo ?? '',
        student.lastName,
        student.firstName,
        record.status ?? '',
        record.status === 'E' ? record.remarks : '',
      ];
    }),
  ];

  return `\uFEFF${rows
    .map((row) => row.map((field) => escapeAttendanceCsvField(field)).join(','))
    .join('\r\n')}`;
}

// Downloads a local template without uploading or retaining its contents.
export function downloadAttendanceImportCsv(
  classRecord: ClassRecord,
  session: AttendanceSessionDraft,
) {
  const csv = createAttendanceImportCsv(classRecord, session);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `pale-attendance-${session.sessionDate}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

// Parses quoted CSV fields, escaped quotes, and embedded newlines without a dependency.
function parseCsvRows(csv: string) {
  const source = csv.startsWith('\uFEFF') ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quoteClosed = false;
  let physicalRow = 1;

  const finishField = () => {
    row.push(field);
    field = '';
    quoteClosed = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else if (character === '\r' && source[index + 1] === '\n') {
        field += '\n';
        index += 1;
        physicalRow += 1;
      } else {
        field += character;
        if (character === '\n' || character === '\r') {
          physicalRow += 1;
        }
      }
      continue;
    }

    if (quoteClosed) {
      if (character === ',') {
        finishField();
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && source[index + 1] === '\n') {
          index += 1;
        }
        finishRow();
        physicalRow += 1;
      } else {
        throw new AttendanceImportValidationError([
          `CSV row ${physicalRow} contains text after a closing quote.`,
        ]);
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new AttendanceImportValidationError([
          `CSV row ${physicalRow} contains a quote inside an unquoted field.`,
        ]);
      }
      inQuotes = true;
    } else if (character === ',') {
      finishField();
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      finishRow();
      physicalRow += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new AttendanceImportValidationError([
      `CSV row ${physicalRow} has an unclosed quoted field.`,
    ]);
  }

  if (quoteClosed || field.length > 0 || row.length > 0) {
    finishRow();
  }

  while (rows.at(-1)?.every((value) => value === '')) {
    rows.pop();
  }

  return rows;
}

// Reads one exact two-column metadata row and reports structural problems together.
function readMetadataValue(
  rows: string[][],
  rowIndex: number,
  expectedKey: string,
  issues: string[],
) {
  const row = rows[rowIndex];
  if (!row || row.length !== 2 || row[0] !== expectedKey) {
    issues.push(`CSV row ${rowIndex + 1} must contain ${expectedKey} and its value.`);
    return '';
  }
  return restoreSpreadsheetSafeField(row[1]);
}

// Validates one PALE template against the currently selected historical or draft roster.
export function parseAttendanceImportCsv(
  csv: string,
  classRecord: ClassRecord,
  session: AttendanceSessionDraft,
): AttendanceImportPreview {
  const rows = parseCsvRows(csv);
  const issues: string[] = [];

  if (rows.length < 7) {
    throw new AttendanceImportValidationError([
      'The file is not a complete PALE Attendance import template.',
    ]);
  }

  const templateRow = rows[0];
  if (
    templateRow.length !== 2 ||
    templateRow[0] !== TEMPLATE_NAME ||
    templateRow[1] !== TEMPLATE_VERSION
  ) {
    issues.push('CSV row 1 must identify PALE Attendance Import template version 1.');
  }

  const classId = readMetadataValue(rows, 1, 'Class ID', issues);
  const classLabel = readMetadataValue(rows, 2, 'Class', issues);
  const sessionId = readMetadataValue(rows, 3, 'Session ID', issues);
  const attendanceDate = readMetadataValue(rows, 4, 'Attendance Date', issues);

  if (classId && classId !== session.classId) {
    issues.push('The CSV belongs to a different class.');
  }
  if (classLabel && classLabel !== getAttendanceImportClassLabel(classRecord)) {
    issues.push('The CSV class details no longer match the selected class.');
  }
  if (sessionId && sessionId !== session.id) {
    issues.push('The CSV belongs to a different attendance date session.');
  }
  if (attendanceDate && attendanceDate !== `DATE:${session.sessionDate}`) {
    issues.push('The CSV attendance date does not match the selected date.');
  }

  if (!rows[5] || !rows[5].every((value) => value === '')) {
    issues.push('CSV row 6 must remain blank.');
  }

  const headerRow = rows[6];
  if (
    !headerRow ||
    headerRow.length !== STUDENT_HEADERS.length ||
    !STUDENT_HEADERS.every((header, index) => headerRow[index] === header)
  ) {
    issues.push('CSV row 7 has missing, renamed, or reordered attendance columns.');
  }

  const expectedRecords = session.records;
  const expectedStudentIds = Object.keys(expectedRecords);
  const importedRecords: WorkingAttendanceRecordsByStudentId = {};
  const seenStudentIds = new Set<string>();

  for (let rowIndex = 7; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const csvRowNumber = rowIndex + 1;

    if (row.length !== STUDENT_HEADERS.length) {
      issues.push(`CSV row ${csvRowNumber} must contain exactly ${STUDENT_HEADERS.length} columns.`);
      continue;
    }

    const studentId = row[0].trim();
    if (!studentId) {
      issues.push(`CSV row ${csvRowNumber} is missing its Student ID.`);
      continue;
    }
    if (seenStudentIds.has(studentId)) {
      issues.push(`CSV row ${csvRowNumber} repeats a student already listed in the file.`);
      continue;
    }
    seenStudentIds.add(studentId);

    const currentRecord = expectedRecords[studentId];
    if (!currentRecord) {
      issues.push(`CSV row ${csvRowNumber} contains a student outside the selected roster.`);
      continue;
    }

    const normalizedStatus = row[4].trim().toUpperCase();
    const status = normalizedStatus === '' ? null : normalizedStatus;
    if (status !== null && !isAttendanceStatusCode(status)) {
      issues.push(`CSV row ${csvRowNumber} must use P, A, L, E, or a blank PALE Status.`);
      continue;
    }

    const remarks = restoreSpreadsheetSafeField(row[5]).trim();
    if (remarks.length > ATTENDANCE_REMARKS_MAX_LENGTH) {
      issues.push(`CSV row ${csvRowNumber} remarks exceed ${ATTENDANCE_REMARKS_MAX_LENGTH} characters.`);
    } else if (status === 'E' && !remarks) {
      issues.push(`CSV row ${csvRowNumber} is Excused and requires Remarks.`);
    } else if (status !== 'E' && remarks) {
      issues.push(`CSV row ${csvRowNumber} has Remarks but is not marked Excused.`);
    }

    importedRecords[studentId] = {
      ...currentRecord,
      student: { ...currentRecord.student },
      status,
      remarks: status === 'E' ? remarks : '',
    };
  }

  for (const studentId of expectedStudentIds) {
    if (!seenStudentIds.has(studentId)) {
      const student = expectedRecords[studentId].student;
      issues.push(`The CSV is missing ${student.lastName}, ${student.firstName}.`);
    }
  }

  if (rows.length - 7 !== expectedStudentIds.length) {
    issues.push('The CSV row count does not match the selected attendance roster.');
  }

  if (issues.length > 0) {
    throw new AttendanceImportValidationError([...new Set(issues)]);
  }

  const changedRows = expectedStudentIds.flatMap((studentId) => {
    const previousRecord = expectedRecords[studentId];
    const nextRecord = importedRecords[studentId];
    if (
      previousRecord.status === nextRecord.status &&
      previousRecord.remarks === nextRecord.remarks
    ) {
      return [];
    }

    return [{
      studentId,
      studentName: `${previousRecord.student.lastName}, ${previousRecord.student.firstName}`,
      previousStatus: previousRecord.status,
      nextStatus: nextRecord.status,
      previousRemarks: previousRecord.remarks,
      nextRemarks: nextRecord.remarks,
    } satisfies AttendanceImportChangedRow];
  });

  return { records: importedRecords, changedRows };
}
