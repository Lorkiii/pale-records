// Builds and validates the editable review state between OCR extraction and draft application.
import {
  cloneAttendanceRecords,
  countAttendanceRecordChanges,
  hasExactAttendanceRoster,
  validateAttendanceSessionDraft,
} from './attendance-draft';
import type {
  AttendanceSessionDraft,
  WorkingAttendanceRecordsByStudentId,
} from './attendance-types';
import type { AttendanceOcrPreview, AttendanceOcrRow } from './attendance-ocr';

export interface AttendanceOcrReviewRow extends AttendanceOcrRow {
  isConfirmed: boolean;
}

export interface AttendanceOcrReviewResult {
  records: WorkingAttendanceRecordsByStudentId;
  changedRecordCount: number;
  confirmedRowCount: number;
  invalidRowCount: number;
  validationMessagesByStudentId: Record<string, string[]>;
  hasExactRoster: boolean;
  isReady: boolean;
}

// Starts every extracted row unconfirmed so OCR can never be applied without human review.
export function createAttendanceOcrReviewRows(preview: AttendanceOcrPreview) {
  return preview.rows.map((row) => ({
    ...row,
    issues: [...row.issues],
    isConfirmed: false,
  }));
}

// Reuses the draft's save-time rules and reports whether the complete review is safe to apply.
export function evaluateAttendanceOcrReview(
  rows: readonly AttendanceOcrReviewRow[],
  session: AttendanceSessionDraft,
): AttendanceOcrReviewResult {
  const reviewedStudentIds = rows.map((row) => row.studentId).sort();
  const hasExactRoster = hasExactAttendanceRoster(session.records, reviewedStudentIds);
  const records = cloneAttendanceRecords(session.records);

  for (const row of rows) {
    const currentRecord = records[row.studentId];
    if (!currentRecord) {
      continue;
    }

    records[row.studentId] = {
      ...currentRecord,
      status: row.status,
      remarks: row.remarks.trim(),
    };
  }

  const validationMessagesByStudentId: Record<string, string[]> = {};
  for (const issue of validateAttendanceSessionDraft({ ...session, records })) {
    validationMessagesByStudentId[issue.studentId] = [
      ...(validationMessagesByStudentId[issue.studentId] ?? []),
      issue.message,
    ];
  }

  const confirmedRowCount = rows.filter((row) => row.isConfirmed).length;
  const invalidRowCount = Object.keys(validationMessagesByStudentId).length;
  const changedRecordCount = countAttendanceRecordChanges(session.records, records);

  return {
    records,
    changedRecordCount,
    confirmedRowCount,
    invalidRowCount,
    validationMessagesByStudentId,
    hasExactRoster,
    isReady: rows.length > 0 &&
      hasExactRoster &&
      invalidRowCount === 0 &&
      confirmedRowCount === rows.length,
  };
}
