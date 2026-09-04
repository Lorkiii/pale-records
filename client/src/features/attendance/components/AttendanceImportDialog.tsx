// Guides template export and local CSV or reviewed scan import before draft application.
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import { AttendanceOcrReviewGrid } from './AttendanceOcrReviewGrid';
import {
  formatAttendanceDateLong,
} from '../attendance-draft';
import {
  ATTENDANCE_IMPORT_MAX_FILE_SIZE_BYTES,
  AttendanceImportValidationError,
  downloadAttendanceImportCsv,
  parseAttendanceImportCsv,
  type AttendanceImportPreview,
} from '../attendance-import';
import {
  ATTENDANCE_SCAN_MAX_FILE_SIZE_BYTES,
  AttendanceOcrValidationError,
  extractAttendanceTemplateScan,
  isAttendanceCsvSelection,
  type AttendanceOcrPreview,
  type AttendanceOcrProgress,
} from '../attendance-ocr';
import {
  createAttendanceOcrReviewRows,
  evaluateAttendanceOcrReview,
  type AttendanceOcrReviewRow,
} from '../attendance-ocr-review';
import {
  exportPrintableAttendanceTemplates,
  type AttendanceTemplateExportAction,
} from '../attendance-template-export';
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_ORDER,
  type AttendanceSessionDraft,
  type AttendanceStatusCode,
  type WorkingAttendanceRecordsByStudentId,
} from '../attendance-types';
import type { DateFormatPreference } from '../../settings/preference-display';

interface AttendanceImportDialogProps {
  classRecord: ClassRecord;
  session: AttendanceSessionDraft;
  createdBy: string;
  dateFormat?: DateFormatPreference;
  onClose: () => void;
  onApply: (records: WorkingAttendanceRecordsByStudentId) => void;
}

const STATUS_CODES: ReadonlyArray<AttendanceStatusCode | null> = [
  ...ATTENDANCE_STATUS_ORDER,
  null,
];

function formatStatus(status: AttendanceStatusCode | null) {
  return status ? `${status} / ${ATTENDANCE_STATUS_LABELS[status]}` : '— / Unmarked';
}

// Keeps the selected file temporary and applies only a fully validated preview.
export function AttendanceImportDialog({
  classRecord,
  session,
  createdBy,
  dateFormat,
  onClose,
  onApply,
}: AttendanceImportDialogProps) {
  const firstTemplateActionRef = useRef<HTMLButtonElement>(null);
  const readAttemptRef = useRef(0);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [templateExportAction, setTemplateExportAction] =
    useState<AttendanceTemplateExportAction | null>(null);
  const [templateErrorMessage, setTemplateErrorMessage] = useState('');
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [preview, setPreview] = useState<AttendanceImportPreview | null>(null);
  const [ocrPreview, setOcrPreview] = useState<AttendanceOcrPreview | null>(null);
  const [ocrReviewRows, setOcrReviewRows] = useState<AttendanceOcrReviewRow[]>([]);
  const [ocrProgress, setOcrProgress] = useState<AttendanceOcrProgress | null>(null);
  const isWorking = isReading || templateExportAction !== null;
  const ocrReview = useMemo(
    () => ocrPreview ? evaluateAttendanceOcrReview(ocrReviewRows, session) : null,
    [ocrPreview, ocrReviewRows, session],
  );
  const changedRecordCount = preview?.changedRows.length ??
    ocrReview?.changedRecordCount ??
    0;
  const canApply = preview
    ? changedRecordCount > 0
    : Boolean(ocrReview?.isReady && changedRecordCount > 0);

  const statusCounts = useMemo(() => {
    const counts: Record<'P' | 'A' | 'L' | 'E' | 'unmarked', number> = {
      P: 0,
      A: 0,
      L: 0,
      E: 0,
      unmarked: 0,
    };

    for (const record of Object.values(preview?.records ?? ocrReview?.records ?? {})) {
      if (record.status) {
        counts[record.status] += 1;
      } else {
        counts.unmarked += 1;
      }
    }
    return counts;
  }, [ocrReview, preview]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const readAttempt = readAttemptRef.current + 1;
    readAttemptRef.current = readAttempt;
    setPreview(null);
    setOcrPreview(null);
    setOcrReviewRows([]);
    setOcrProgress(null);
    setErrorMessages([]);

    if (files.length === 0) {
      setSelectedFileNames([]);
      return;
    }

    setSelectedFileNames(files.map((file) => file.name));

    setIsReading(true);
    try {
      if (isAttendanceCsvSelection(files)) {
        const file = files[0];
        if (file.size > ATTENDANCE_IMPORT_MAX_FILE_SIZE_BYTES) {
          throw new AttendanceImportValidationError([
            'The attendance CSV must be 256 KB or smaller.',
          ]);
        }
        const csv = await file.text();
        if (readAttempt !== readAttemptRef.current) {
          return;
        }
        setPreview(parseAttendanceImportCsv(csv, classRecord, session));
        return;
      }

      const extractedPreview = await extractAttendanceTemplateScan(
        files,
        session,
        (progress) => {
          if (readAttempt === readAttemptRef.current) {
            setOcrProgress(progress);
          }
        },
      );
      if (readAttempt !== readAttemptRef.current) {
        return;
      }
      setOcrPreview(extractedPreview);
      setOcrReviewRows(createAttendanceOcrReviewRows(extractedPreview));
    } catch (error: unknown) {
      if (readAttempt !== readAttemptRef.current) {
        return;
      }
      setErrorMessages(
        error instanceof AttendanceImportValidationError ||
        error instanceof AttendanceOcrValidationError
          ? error.messages
          : ['PALE could not read this attendance file. Download a fresh template and try again.'],
      );
    } finally {
      if (readAttempt === readAttemptRef.current) {
        setIsReading(false);
        setOcrProgress(null);
      }
    }
  };

  const handleApply = () => {
    if (preview && preview.changedRows.length > 0) {
      onApply(preview.records);
      return;
    }

    if (ocrReview?.isReady && ocrReview.changedRecordCount > 0) {
      onApply(ocrReview.records);
    }
  };

  const handleOcrStatusChange = (
    studentId: string,
    status: AttendanceStatusCode | null,
  ) => {
    setOcrReviewRows((currentRows) => currentRows.map((row) =>
      row.studentId === studentId
        ? { ...row, status, isConfirmed: false }
        : row));
  };

  const handleOcrRemarksChange = (studentId: string, remarks: string) => {
    setOcrReviewRows((currentRows) => currentRows.map((row) =>
      row.studentId === studentId
        ? { ...row, remarks, isConfirmed: false }
        : row));
  };

  const handleOcrConfirmationChange = (
    studentId: string,
    isConfirmed: boolean,
  ) => {
    setOcrReviewRows((currentRows) => currentRows.map((row) =>
      row.studentId === studentId
        ? { ...row, isConfirmed }
        : row));
  };

  const handleTemplateExport = async (action: AttendanceTemplateExportAction) => {
    setTemplateExportAction(action);
    setTemplateErrorMessage('');

    try {
      await exportPrintableAttendanceTemplates({
        action,
        classRecord,
        sessions: [session],
        createdBy,
      });
    } catch (error) {
      setTemplateErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to generate the printable attendance template. Please try again.',
      );
    } finally {
      setTemplateExportAction(null);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Import attendance"
      description={`${classRecord.subjectName} / ${formatAttendanceDateLong(session.sessionDate, dateFormat)}`}
      isDismissDisabled={isWorking}
      initialFocusRef={firstTemplateActionRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isWorking}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!canApply || isWorking}
            title={ocrPreview && !ocrReview?.isReady
              ? 'Confirm every valid scanned row before applying attendance'
              : changedRecordCount === 0
                ? 'The imported attendance does not change the current draft'
                : undefined}
          >
            Apply to draft
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Notice variant="info" title="Local file processing">
          Your CSV, PDF, or image is read only in this browser and is not uploaded. Applying a reviewed import updates the unsaved draft; use Save attendance to persist it.
        </Notice>

        <section className="border border-paper-border bg-paper p-4" aria-labelledby="attendance-template-heading">
          <h3 id="attendance-template-heading" className="text-sm font-semibold text-ink">
            1. Choose how to record attendance
          </h3>
          <p id="attendance-scan-hint" className="mt-1 text-sm leading-6 text-ink-secondary">
            Both templates use this date and roster. Choose PDF for a paper sheet or CSV for a spreadsheet you can import below.
          </p>

          {templateErrorMessage ? (
            <Notice variant="error" title="Template not generated" className="mt-4">
              {templateErrorMessage}
            </Notice>
          ) : null}

          <div className="mt-4 grid gap-px border border-ink bg-ink sm:grid-cols-2">
            <article className="flex min-w-0 flex-col bg-paper-light p-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Paper workflow
              </p>
              <h4 className="mt-1 text-sm font-semibold text-ink">Printable PDF</h4>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-secondary">
                Open or download a blank A4 sheet, write attendance, then scan every page as PDF, PNG, or JPEG.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  ref={firstTemplateActionRef}
                  size="sm"
                  onClick={() => handleTemplateExport('open')}
                  isLoading={templateExportAction === 'open'}
                  disabled={isWorking}
                >
                  Open printable PDF
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleTemplateExport('download')}
                  isLoading={templateExportAction === 'download'}
                  disabled={isWorking}
                >
                  Download PDF
                </Button>
              </div>
            </article>

            <article className="flex min-w-0 flex-col bg-paper-light p-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Spreadsheet workflow
              </p>
              <h4 className="mt-1 text-sm font-semibold text-ink">Editable CSV</h4>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-secondary">
                Download the file, edit only PALE Status and Remarks, then upload that same CSV below.
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                onClick={() => downloadAttendanceImportCsv(classRecord, session)}
                disabled={isWorking}
              >
                Download CSV template
              </Button>
            </article>
          </div>
        </section>

        <section className="border border-paper-border bg-paper p-4" aria-labelledby="attendance-upload-heading">
          <h3 id="attendance-upload-heading" className="text-sm font-semibold text-ink">
            2. Choose the completed file
          </h3>
          <p id="attendance-file-hint" className="mt-1 text-sm leading-6 text-ink-secondary">
            Choose one CSV/PDF, or select all PNG/JPEG pages together. CSV limit: 256 KB. Scan limit: {ATTENDANCE_SCAN_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file.
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Scans must show every corner square and the full identity strip along the bottom edge.
          </p>
          <label htmlFor="attendance-import-file" className="sr-only">
            Completed PALE attendance CSV, PDF, PNG, or JPEG
          </label>
          <input
            id="attendance-import-file"
            type="file"
            accept=".csv,text/csv,.pdf,application/pdf,.png,image/png,.jpg,.jpeg,image/jpeg"
            multiple
            aria-describedby="attendance-file-hint attendance-scan-hint"
            disabled={isWorking}
            onChange={handleFileChange}
            className="mt-4 block min-h-11 min-w-0 w-full cursor-pointer border border-ink bg-paper-light text-sm text-ink file:mr-4 file:min-h-11 file:cursor-pointer file:border-0 file:border-r file:border-ink file:bg-ink file:px-4 file:font-mono file:text-xs file:font-semibold file:uppercase file:tracking-wider file:text-paper-light hover:file:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          />
          {selectedFileNames.length > 0 ? (
            <div className="mt-2 font-mono text-xs text-ink-secondary">
              <p>Selected {selectedFileNames.length === 1 ? 'file' : `${selectedFileNames.length} files`}:</p>
              <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto" aria-label="Selected attendance files">
                {selectedFileNames.map((fileName, index) => (
                  <li key={`${fileName}-${index}`} className="break-all">{fileName}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {isReading ? (
          <div role="status" className="space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {ocrProgress?.message ?? 'Checking attendance file…'}
            </p>
            {ocrProgress ? (
              <progress
                className="h-2 w-full accent-ink"
                max={100}
                value={ocrProgress.percent}
                aria-label="Attendance OCR progress"
              />
            ) : null}
          </div>
        ) : null}

        {errorMessages.length > 0 ? (
          <Notice variant="error" title="Attendance file cannot be read">
            <ul className="max-h-56 list-disc space-y-1 overflow-y-auto pl-4">
              {errorMessages.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </Notice>
        ) : null}

        {preview ? (
          <section className="space-y-4" aria-labelledby="attendance-import-preview-heading">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                3 / Review and apply
              </p>
              <h3 id="attendance-import-preview-heading" className="mt-1 text-base font-semibold text-ink">
                {preview.changedRows.length} attendance {preview.changedRows.length === 1 ? 'record' : 'records'} will change
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-5" aria-label="Imported attendance totals">
              {STATUS_CODES.map((status) => {
                const count = status ? statusCounts[status] : statusCounts.unmarked;
                return (
                  <div key={status ?? 'unmarked'} className="bg-paper-light p-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                      {status ?? '—'} / {status ? ATTENDANCE_STATUS_LABELS[status] : 'Unmarked'}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{count}</p>
                  </div>
                );
              })}
            </div>

            {preview.changedRows.length === 0 ? (
              <Notice variant="info" title="No changes found">
                The CSV already matches the current attendance draft.
              </Notice>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1" aria-label="Attendance changes">
                {preview.changedRows.map((row) => (
                  <article key={row.studentId} className="border border-paper-border bg-paper-light p-3">
                    <p className="text-sm font-semibold text-ink">{row.studentName}</p>
                    <p className="mt-1 text-sm text-ink-secondary">
                      {formatStatus(row.previousStatus)} → {formatStatus(row.nextStatus)}
                    </p>
                    {row.previousRemarks !== row.nextRemarks ? (
                      <p className="mt-1 break-words text-sm text-ink-secondary">
                        Remarks: {row.nextRemarks || 'None'}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {ocrPreview ? (
          <section className="space-y-4" aria-labelledby="attendance-ocr-preview-heading">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                3 / Review scanned attendance
              </p>
              <h3 id="attendance-ocr-preview-heading" className="mt-1 text-base font-semibold text-ink">
                {ocrPreview.rows.length} roster rows extracted from {ocrPreview.pageCount} {ocrPreview.pageCount === 1 ? 'page' : 'pages'}
              </h3>
            </div>

            <Notice variant="info" title="Review is required before applying">
              OCR can misread handwriting. Correct the extracted values and confirm every student row before applying this scan to the unsaved draft.
            </Notice>

            <div className="grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-5" aria-label="Extracted attendance totals">
              {STATUS_CODES.map((status) => {
                const count = status ? statusCounts[status] : statusCounts.unmarked;
                return (
                  <div key={status ?? 'unmarked'} className="bg-paper-light p-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                      {status ?? '—'} / {status ? ATTENDANCE_STATUS_LABELS[status] : 'Unmarked'}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{count}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-ink-secondary">
              {ocrReview?.changedRecordCount ?? 0} attendance {(ocrReview?.changedRecordCount ?? 0) === 1 ? 'record differs' : 'records differ'} from the current draft.
            </p>

            {ocrReview ? (
              <AttendanceOcrReviewGrid
                rows={ocrReviewRows}
                review={ocrReview}
                onStatusChange={handleOcrStatusChange}
                onRemarksChange={handleOcrRemarksChange}
                onConfirmationChange={handleOcrConfirmationChange}
              />
            ) : null}
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
