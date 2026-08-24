// Owns the temporary remarks, proof selection, and explicit status clearing form.
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Label } from '../../../components/ui/Label';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import type { StudentRecord } from '../../students/student-types';
import {
  formatAttendanceDateLong,
  formatFileSize,
  hasExcuseDetails,
} from '../attendance-draft';
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceDraftRecord,
  type AttendanceStatusCode,
  type SelectedProofMetadata,
} from '../attendance-types';

interface AttendanceDetailsDialogProps {
  student: StudentRecord;
  classRecord: ClassRecord;
  date: string;
  record: AttendanceDraftRecord;
  isEditable: boolean;
  onClose: () => void;
  onApply: (record: AttendanceDraftRecord) => void;
}

const SUPPORTED_PROOF_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const STATUS_BADGE_CLASS_NAMES: Record<AttendanceStatusCode, string> = {
  P: 'border-signal-emerald text-signal-emerald',
  A: 'border-signal-red text-signal-red',
  L: 'border-signal-amber text-signal-amber',
  E: 'border-signal-blue text-signal-blue',
};

// Builds a concise real-class label for the dialog summary.
function getClassLabel(classRecord: ClassRecord) {
  const identity = classRecord.subjectCode
    ? `${classRecord.subjectCode} — ${classRecord.subjectName}`
    : classRecord.subjectName;
  return classRecord.section ? `${identity} / ${classRecord.section}` : identity;
}

// Captures the selected File together with display metadata while retaining the original object.
function toSelectedProofMetadata(file: File): SelectedProofMetadata {
  return {
    file,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

// Keeps canceled edits inside the dialog and reports only explicitly applied values to the page.
export function AttendanceDetailsDialog({
  student,
  classRecord,
  date,
  record,
  isEditable,
  onClose,
  onApply,
}: AttendanceDetailsDialogProps) {
  const [status, setStatus] = useState<AttendanceStatusCode | null>(record.status);
  const [remarks, setRemarks] = useState(record.remarks);
  const [proof, setProof] = useState<SelectedProofMetadata | null>(record.proof);
  const [remarksError, setRemarksError] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workingRecord: AttendanceDraftRecord = { status, remarks, proof };
  const hasDetailsConflict = status !== 'E' && hasExcuseDetails(workingRecord);
  const statusLabel = status ? `${status} / ${ATTENDANCE_STATUS_LABELS[status]}` : '— / Unmarked';
  const statusClassName = status
    ? STATUS_BADGE_CLASS_NAMES[status]
    : 'border-paper-dark text-ink-secondary';

  // Rejects unsupported local selections without replacing the previously chosen proof.
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!SUPPORTED_PROOF_TYPES.has(file.type)) {
      setFileError('File type not supported. Select a PDF, JPEG, or PNG file.');
      event.target.value = '';
      return;
    }

    setProof(toSelectedProofMetadata(file));
    setFileError('');
  };

  // Validates the Excused remark rule before applying the temporary dialog values.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedRemarks = remarks.trim();
    if (status === 'E' && normalizedRemarks.length === 0) {
      setRemarksError('A remark is required when the attendance status is Excused.');
      return;
    }

    onApply({
      status,
      remarks: normalizedRemarks,
      proof,
    });
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Attendance details"
      description={`${student.lastName}, ${student.firstName} — ${formatAttendanceDateLong(date)}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="attendance-details-form" disabled={!isEditable}>
            Apply details
          </Button>
        </>
      }
    >
      <form id="attendance-details-form" onSubmit={handleSubmit} noValidate>
        {!isEditable ? (
          <Notice variant="info" title="Read-only date" className="mb-5">
            Choose Edit attendance to change this student record.
          </Notice>
        ) : null}

        <dl className="grid gap-px border border-ink bg-ink sm:grid-cols-2">
          <div className="bg-paper-light px-3 py-3">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Student</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{student.lastName}, {student.firstName}</dd>
            {student.studentNo ? (
              <dd className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">{student.studentNo}</dd>
            ) : null}
          </div>
          <div className="bg-paper-light px-3 py-3">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Class</dt>
            <dd className="mt-1 text-sm text-ink-secondary">{getClassLabel(classRecord)}</dd>
          </div>
          <div className="bg-paper-light px-3 py-3">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Date</dt>
            <dd className="mt-1 text-sm text-ink-secondary">{formatAttendanceDateLong(date)}</dd>
          </div>
          <div className="bg-paper-light px-3 py-3">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Current status</dt>
            <dd className={`mt-1 inline-flex border bg-paper-light px-2 py-1 font-mono text-xs font-bold uppercase ${statusClassName}`}>
              {statusLabel}
            </dd>
          </div>
        </dl>

        {hasDetailsConflict ? (
          <Notice variant="warning" title="Excuse details preserved" className="mt-5">
            This status is not Excused, so the date cannot be saved until you return the status to E or intentionally remove the remark and proof.
          </Notice>
        ) : null}

        <div className="mt-5">
          <Label htmlFor="attendance-remarks" required={status === 'E'} optional={status !== 'E'}>
            Remarks
          </Label>
          <textarea
            id="attendance-remarks"
            value={remarks}
            onChange={(event) => {
              setRemarks(event.target.value);
              setRemarksError('');
            }}
            disabled={!isEditable}
            rows={5}
            aria-invalid={Boolean(remarksError)}
            aria-describedby={remarksError ? 'attendance-remarks-error' : 'attendance-remarks-hint'}
            className={`w-full resize-y rounded-none border bg-paper-light px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:bg-paper-muted disabled:opacity-70 ${
              remarksError ? 'border-signal-red' : 'border-paper-dark'
            }`}
            placeholder="Add the reason or relevant attendance note."
          />
          {remarksError ? (
            <p id="attendance-remarks-error" className="mt-1 font-mono text-xs text-signal-red">
              /!/ {remarksError}
            </p>
          ) : (
            <p id="attendance-remarks-hint" className="mt-1 text-xs leading-5 text-ink-muted">
              Required only when the status is Excused.
            </p>
          )}
          {remarks.trim() && isEditable ? (
            <Button type="button" variant="ghost" className="mt-2" onClick={() => setRemarks('')}>
              Remove remark
            </Button>
          ) : null}
        </div>

        <div className="mt-5 border-t border-paper-border pt-5">
          <Label htmlFor="attendance-proof" optional>
            {proof ? 'Replace proof' : 'Proof file'}
          </Label>
          <input
            ref={fileInputRef}
            id="attendance-proof"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={!isEditable}
            onChange={handleFileChange}
            aria-invalid={Boolean(fileError)}
            aria-describedby={`attendance-proof-hint${fileError ? ' attendance-proof-error' : ''}`}
            className="block min-h-11 w-full cursor-pointer border border-paper-dark bg-paper-light text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:border-r file:border-paper-dark file:bg-paper-muted file:px-3 file:font-mono file:text-xs file:font-bold file:uppercase file:text-ink disabled:cursor-not-allowed disabled:bg-paper-muted disabled:opacity-70"
          />
          <p id="attendance-proof-hint" className="mt-1 text-xs leading-5 text-ink-muted">
            Supported types: PDF, JPEG, and PNG. One optional file may be selected for later submission.
          </p>
          {fileError ? (
            <p id="attendance-proof-error" className="mt-1 font-mono text-xs text-signal-red">
              /!/ {fileError}
            </p>
          ) : null}

          {proof ? (
            <div className="mt-3 border border-paper-dark bg-paper-muted p-3">
              <p className="break-all text-sm font-semibold text-ink">{proof.name}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                {proof.type} / {formatFileSize(proof.size)}
              </p>
              {isEditable ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3"
                  onClick={() => {
                    setProof(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Remove proof
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <Notice variant="info" title="File remains local" className="mt-5">
          Selecting a file stores the original File object in this page only. It is not uploaded, linked, or persisted.
        </Notice>

        <div className="mt-5 border-t border-paper-border pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={!isEditable || status === null}
            onClick={() => {
              setStatus(null);
              setRemarksError('');
            }}
          >
            Clear status
          </Button>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Clearing the status does not remove an existing remark or proof.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
