// Owns temporary Excused-remark editing and the honest unavailable proof-storage boundary.
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Label } from '../../../components/ui/Label';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import type { DateFormatPreference } from '../../settings/preference-display';
import { formatAttendanceDateLong } from '../attendance-draft';
import {
  ATTENDANCE_REMARKS_MAX_LENGTH,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceStatusCode,
  type AttendanceStudentRecord,
  type WorkingAttendanceRecord,
} from '../attendance-types';

interface AttendanceDetailsDialogProps {
  student: AttendanceStudentRecord;
  classRecord: ClassRecord;
  date: string;
  record: WorkingAttendanceRecord;
  isEditable: boolean;
  dateFormat?: DateFormatPreference;
  onClose: () => void;
  onApply: (record: WorkingAttendanceRecord) => void;
}

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

// Keeps canceled remark edits local and applies only explicitly confirmed working values.
export function AttendanceDetailsDialog({
  student,
  classRecord,
  date,
  record,
  isEditable,
  dateFormat,
  onClose,
  onApply,
}: AttendanceDetailsDialogProps) {
  const [status, setStatus] = useState<AttendanceStatusCode | null>(record.status);
  const [remarks, setRemarks] = useState(record.remarks);
  const [remarksError, setRemarksError] = useState('');
  const statusLabel = status ? `${status} / ${ATTENDANCE_STATUS_LABELS[status]}` : '— / Unmarked';
  const statusClassName = status
    ? STATUS_BADGE_CLASS_NAMES[status]
    : 'border-paper-dark text-ink-secondary';
  const remarksEnabled = isEditable && status === 'E';

  // Enforces Excused-only, trimmed, bounded remarks before applying dialog state.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedRemarks = remarks.trim();
    if (status === 'E' && normalizedRemarks.length === 0) {
      setRemarksError('A remark is required when the attendance status is Excused.');
      return;
    }

    if (normalizedRemarks.length > ATTENDANCE_REMARKS_MAX_LENGTH) {
      setRemarksError(`Remarks must be at most ${ATTENDANCE_REMARKS_MAX_LENGTH} characters.`);
      return;
    }

    onApply({
      ...record,
      status,
      remarks: status === 'E' ? normalizedRemarks : '',
    });
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Attendance details"
      description={`${student.lastName}, ${student.firstName} — ${formatAttendanceDateLong(date, dateFormat)}`}
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
            Choose Edit attendance to change this persisted student record.
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
            <dd className="mt-1 text-sm text-ink-secondary">{formatAttendanceDateLong(date, dateFormat)}</dd>
          </div>
          <div className="bg-paper-light px-3 py-3">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Current status</dt>
            <dd className={`mt-1 inline-flex border bg-paper-light px-2 py-1 font-mono text-xs font-bold uppercase ${statusClassName}`}>
              {statusLabel}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <Label htmlFor="attendance-remarks" required={status === 'E'}>
            Excused remark
          </Label>
          <textarea
            id="attendance-remarks"
            value={status === 'E' ? remarks : ''}
            onChange={(event) => {
              setRemarks(event.target.value);
              setRemarksError('');
            }}
            disabled={!remarksEnabled}
            maxLength={ATTENDANCE_REMARKS_MAX_LENGTH}
            rows={5}
            aria-invalid={Boolean(remarksError)}
            aria-describedby={remarksError ? 'attendance-remarks-error' : 'attendance-remarks-hint'}
            className={`w-full resize-y rounded-none border bg-paper-light px-3 py-2 text-sm leading-6 text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:bg-paper-muted disabled:opacity-70 ${
              remarksError ? 'border-signal-red' : 'border-paper-dark'
            }`}
            placeholder="Add the reason for the Excused attendance status."
          />
          {remarksError ? (
            <p id="attendance-remarks-error" className="mt-1 font-mono text-xs text-signal-red">
              /!/ {remarksError}
            </p>
          ) : (
            <div id="attendance-remarks-hint" className="mt-1 flex flex-wrap justify-between gap-2 text-xs leading-5 text-ink-muted">
              <span>
                {status === 'E'
                  ? 'Required for Excused attendance and saved with the sheet.'
                  : 'Remarks are available only when the status is Excused.'}
              </span>
              <span className="font-mono">{status === 'E' ? remarks.length : 0}/{ATTENDANCE_REMARKS_MAX_LENGTH}</span>
            </div>
          )}
          {status === 'E' && remarks.trim() && remarksEnabled ? (
            <Button type="button" variant="ghost" className="mt-2" onClick={() => setRemarks('')}>
              Remove remark
            </Button>
          ) : null}
        </div>

        <div className="mt-5 border-t border-paper-border pt-5">
          <Label htmlFor="attendance-proof" optional>
            Proof file
          </Label>
          <input
            id="attendance-proof"
            type="file"
            disabled
            aria-describedby="attendance-proof-hint"
            className="block min-h-11 w-full cursor-not-allowed border border-paper-dark bg-paper-muted text-sm text-ink opacity-70 file:mr-3 file:min-h-11 file:border-0 file:border-r file:border-paper-dark file:bg-paper-muted file:px-3 file:font-mono file:text-xs file:font-bold file:uppercase file:text-ink"
          />
          <p id="attendance-proof-hint" className="mt-1 text-xs leading-5 text-ink-muted">
            Proof selection is unavailable because Save attendance cannot persist files in this phase.
          </p>
        </div>

        <Notice variant="info" title="Proof upload unavailable" className="mt-5">
          Proof upload will be enabled after protected file storage is configured. PALE does not upload to the Express filesystem or store file binaries in the database.
        </Notice>

        <div className="mt-5 border-t border-paper-border pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={!isEditable || status === null}
            onClick={() => {
              setStatus(null);
              setRemarks('');
              setRemarksError('');
            }}
          >
            Clear status
          </Button>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Clearing the status also clears the Excused remark from this working copy.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
