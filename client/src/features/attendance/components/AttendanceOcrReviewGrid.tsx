// Renders the editable, row-confirmed review gate for scanned Attendance templates.
import { Checkbox } from '../../../components/ui/Checkbox';
import { Notice } from '../../../components/ui/Notice';
import { Select, type SelectOption } from '../../../components/ui/Select';
import {
  ATTENDANCE_REMARKS_MAX_LENGTH,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_ORDER,
  isAttendanceStatusCode,
  type AttendanceStatusCode,
} from '../attendance-types';
import type {
  AttendanceOcrReviewResult,
  AttendanceOcrReviewRow,
} from '../attendance-ocr-review';

interface AttendanceOcrReviewGridProps {
  rows: readonly AttendanceOcrReviewRow[];
  review: AttendanceOcrReviewResult;
  onStatusChange: (
    studentId: string,
    status: AttendanceStatusCode | null,
  ) => void;
  onRemarksChange: (studentId: string, remarks: string) => void;
  onConfirmationChange: (studentId: string, isConfirmed: boolean) => void;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: '— / Unmarked' },
  ...ATTENDANCE_STATUS_ORDER.map((status) => ({
    value: status,
    label: `${status} / ${ATTENDANCE_STATUS_LABELS[status]}`,
  })),
];

function parseStatus(value: string): AttendanceStatusCode | null {
  return isAttendanceStatusCode(value) ? value : null;
}

function getOcrStatusLabel(row: AttendanceOcrReviewRow) {
  if (row.rawStatusText) {
    return `OCR read ${row.rawStatusText} at ${row.statusConfidence}% confidence.`;
  }
  return `OCR read this status as blank at ${row.statusConfidence}% confidence.`;
}

export function AttendanceOcrReviewGrid({
  rows,
  review,
  onStatusChange,
  onRemarksChange,
  onConfirmationChange,
}: AttendanceOcrReviewGridProps) {
  const flaggedRowCount = rows.filter((row) => row.needsReview).length;
  const remainingRowCount = rows.length - review.confirmedRowCount;

  return (
    <div className="space-y-4">
      {!review.hasExactRoster ? (
        <Notice variant="error" title="Roster changed during review">
          Close this dialog and reopen the selected attendance date before importing again.
        </Notice>
      ) : null}

      <div
        className="grid gap-px border border-ink bg-ink sm:grid-cols-3"
        aria-label="OCR review progress"
        aria-live="polite"
      >
        <div className="bg-paper-light p-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Confirmed
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
            {review.confirmedRowCount}/{rows.length}
          </p>
        </div>
        <div className="bg-paper-light p-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            OCR flagged
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
            {flaggedRowCount}
          </p>
        </div>
        <div className="bg-paper-light p-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Invalid
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
            {review.invalidRowCount}
          </p>
        </div>
      </div>

      <p className="text-sm leading-6 text-ink-secondary" role="status">
        {remainingRowCount === 0
          ? 'Every row is confirmed. Review the totals, then apply the changes to the draft.'
          : `${remainingRowCount} ${remainingRowCount === 1 ? 'row remains' : 'rows remain'} to be confirmed.`}
        {' '}Editing a confirmed status or remark requires that row to be confirmed again.
      </p>

      <div
        className="max-h-[32rem] overflow-auto border border-ink"
        tabIndex={0}
        aria-label="Editable scanned attendance review"
      >
        <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-paper-muted">
            <tr>
              <th scope="col" className="border-b border-r border-ink px-3 py-2 font-semibold text-ink">
                Student
              </th>
              <th scope="col" className="w-48 border-b border-r border-ink px-3 py-2 font-semibold text-ink">
                Status
              </th>
              <th scope="col" className="min-w-72 border-b border-r border-ink px-3 py-2 font-semibold text-ink">
                Remarks
              </th>
              <th scope="col" className="w-36 border-b border-ink px-3 py-2 font-semibold text-ink">
                Review
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const fieldIdSuffix = row.rosterRowNumber;
              const sourceIssueId = `attendance-ocr-source-${fieldIdSuffix}`;
              const validationIssueId = `attendance-ocr-validation-${fieldIdSuffix}`;
              const validationMessages =
                review.validationMessagesByStudentId[row.studentId] ?? [];
              const describedBy = [
                sourceIssueId,
                validationMessages.length > 0 ? validationIssueId : null,
              ].filter(Boolean).join(' ');

              return (
                <tr
                  key={row.studentId}
                  className={row.needsReview ? 'bg-paper-muted' : 'bg-paper-light'}
                >
                  <th
                    scope="row"
                    className="border-b border-r border-paper-border px-3 py-3 align-top font-medium text-ink"
                  >
                    <span className="mr-2 font-mono text-xs text-ink-muted">
                      {row.rosterRowNumber}.
                    </span>
                    {row.studentName}
                    <span
                      id={sourceIssueId}
                      className={`mt-2 block text-xs leading-5 ${
                        row.issues.length > 0 ? 'font-medium text-signal-red' : 'text-ink-muted'
                      }`}
                    >
                      {row.issues.length > 0
                        ? `OCR flagged: ${row.issues.join(' ')}`
                        : 'OCR found no confidence warnings.'}
                    </span>
                  </th>
                  <td className="border-b border-r border-paper-border px-3 py-3 align-top">
                    <Select
                      id={`attendance-ocr-status-${fieldIdSuffix}`}
                      aria-label={`Attendance status for ${row.studentName}`}
                      aria-describedby={describedBy}
                      options={STATUS_OPTIONS}
                      size="sm"
                      value={row.status ?? ''}
                      onChange={(event) => {
                        onStatusChange(row.studentId, parseStatus(event.target.value));
                      }}
                    />
                    <p className="mt-2 font-mono text-[10px] leading-4 text-ink-muted">
                      {getOcrStatusLabel(row)}
                    </p>
                  </td>
                  <td className="border-b border-r border-paper-border px-3 py-3 align-top">
                    <label className="sr-only" htmlFor={`attendance-ocr-remarks-${fieldIdSuffix}`}>
                      Remarks for {row.studentName}
                    </label>
                    <textarea
                      id={`attendance-ocr-remarks-${fieldIdSuffix}`}
                      value={row.remarks}
                      onChange={(event) => onRemarksChange(row.studentId, event.target.value)}
                      maxLength={ATTENDANCE_REMARKS_MAX_LENGTH}
                      rows={2}
                      aria-invalid={validationMessages.length > 0}
                      aria-describedby={describedBy}
                      className={`w-full resize-y rounded-none border bg-paper-light px-2.5 py-2 text-sm leading-5 text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink ${
                        validationMessages.length > 0
                          ? 'border-signal-red'
                          : 'border-paper-dark'
                      }`}
                      placeholder={row.status === 'E'
                        ? 'Required reason for Excused attendance'
                        : 'Leave blank unless the status is Excused'}
                    />
                    <div className="mt-1 flex flex-wrap justify-between gap-2 font-mono text-[10px] leading-4 text-ink-muted">
                      <span>OCR remarks confidence: {row.remarksConfidence}%</span>
                      <span>{row.remarks.length}/{ATTENDANCE_REMARKS_MAX_LENGTH}</span>
                    </div>
                    {validationMessages.length > 0 ? (
                      <ul
                        id={validationIssueId}
                        className="mt-1 list-disc space-y-1 pl-4 text-xs font-medium text-signal-red"
                      >
                        {validationMessages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="border-b border-paper-border px-3 py-3 align-top">
                    <Checkbox
                      id={`attendance-ocr-confirmed-${fieldIdSuffix}`}
                      label="Confirmed"
                      description={validationMessages.length > 0
                        ? 'Resolve this row first.'
                        : 'I checked this row.'}
                      size="sm"
                      checked={row.isConfirmed}
                      disabled={validationMessages.length > 0 || !review.hasExactRoster}
                      onChange={(isConfirmed) => {
                        onConfirmationChange(row.studentId, isConfirmed);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
