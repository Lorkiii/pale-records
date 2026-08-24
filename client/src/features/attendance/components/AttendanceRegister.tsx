// Renders the accessible sticky attendance matrix and selected-date detail columns.
import type { StudentRecord } from '../../students/student-types';
import {
  cycleAttendanceStatus,
  formatAttendanceDateLong,
  formatAttendanceDateShort,
  hasExcuseDetails,
} from '../attendance-draft';
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceDateDraft,
  type AttendanceDraftRecord,
  type AttendanceStatusCode,
} from '../attendance-types';

interface AttendanceRegisterProps {
  roster: StudentRecord[];
  dateDrafts: AttendanceDateDraft[];
  selectedDate: string;
  isEditing: boolean;
  liveMessage: string;
  onSelectDate: (date: string) => void;
  onCycleStatus: (studentId: string) => void;
  onOpenDetails: (student: StudentRecord) => void;
}

const EMPTY_RECORD: AttendanceDraftRecord = {
  status: null,
  remarks: '',
  proof: null,
};

const STATUS_CLASS_NAMES: Record<AttendanceStatusCode, string> = {
  P: 'border-signal-emerald bg-signal-emerald/10 text-signal-emerald',
  A: 'border-signal-red bg-signal-red/10 text-signal-red',
  L: 'border-signal-amber bg-signal-amber/10 text-signal-amber',
  E: 'border-signal-blue bg-signal-blue/10 text-signal-blue',
};

// Provides a restrained inline paperclip that never stands alone as the proof label.
function PaperclipIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m5.4 8.7 4.1-4.1a2 2 0 0 1 2.8 2.8L7.1 12.6a3 3 0 1 1-4.2-4.2l5.2-5.2" />
    </svg>
  );
}

// Builds a complete action label for editable, selectable, and review-only cells.
function getStatusButtonLabel(
  student: StudentRecord,
  date: string,
  record: AttendanceDraftRecord,
  isSelected: boolean,
  isEditable: boolean,
) {
  const studentName = `${student.lastName}, ${student.firstName}`;
  const currentStatus = record.status ? ATTENDANCE_STATUS_LABELS[record.status] : 'Unmarked';
  const dateLabel = formatAttendanceDateLong(date);

  if (isEditable) {
    const nextStatus = cycleAttendanceStatus(record.status);
    return `${studentName}, ${dateLabel}, ${currentStatus}. Activate to change to ${ATTENDANCE_STATUS_LABELS[nextStatus]}.`;
  }

  if (!isSelected) {
    return `${studentName}, ${dateLabel}, ${currentStatus}. Read-only. Activate to select this date.`;
  }

  return `${studentName}, ${dateLabel}, ${currentStatus}. Read-only. Activate to review attendance details.`;
}

// Presents each status as a letter plus optional detail indicators and an explicit detail action.
function AttendanceStatusCell({
  student,
  dateDraft,
  isSelected,
  isEditing,
  onSelectDate,
  onCycleStatus,
  onOpenDetails,
}: {
  student: StudentRecord;
  dateDraft: AttendanceDateDraft;
  isSelected: boolean;
  isEditing: boolean;
  onSelectDate: (date: string) => void;
  onCycleStatus: (studentId: string) => void;
  onOpenDetails: (student: StudentRecord) => void;
}) {
  const record = dateDraft.records[student.id] ?? EMPTY_RECORD;
  const isEditable = isSelected && isEditing;
  const statusClassName = record.status
    ? STATUS_CLASS_NAMES[record.status]
    : 'border-paper-dark bg-paper-light text-ink-secondary';
  const containsDetails = hasExcuseDetails(record);
  const hasDetailsConflict = record.status !== 'E' && containsDetails;

  // Gives one click one responsibility: select, cycle while editing, or review while read-only.
  const handleStatusClick = () => {
    if (!isSelected) {
      onSelectDate(dateDraft.date);
    } else if (isEditing) {
      onCycleStatus(student.id);
    } else {
      onOpenDetails(student);
    }
  };

  return (
    <td
      className={`w-28 min-w-28 border-r border-b border-paper-border align-top ${
        isSelected ? 'border-x-2 border-x-ink bg-paper-muted' : 'bg-paper-light'
      }`}
    >
      <div className="p-1.5">
        <button
          type="button"
          aria-label={getStatusButtonLabel(student, dateDraft.date, record, isSelected, isEditable)}
          onClick={handleStatusClick}
          className={`flex min-h-11 w-full cursor-pointer flex-col items-center justify-center border px-2 py-2 font-mono transition-colors hover:border-ink focus-visible:relative focus-visible:z-10 ${statusClassName}`}
        >
          <span className="text-lg font-bold leading-none">{record.status ?? '—'}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
            {record.status ? ATTENDANCE_STATUS_LABELS[record.status] : 'Unmarked'}
          </span>
          {record.remarks.trim() || record.proof ? (
            <span className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
              {record.remarks.trim() ? <span>Remark</span> : null}
              {record.proof ? (
                <span className="inline-flex items-center gap-1">
                  <PaperclipIcon /> Proof
                </span>
              ) : null}
            </span>
          ) : null}
          {hasDetailsConflict ? (
            <span className="mt-1 border-t border-signal-red pt-1 text-[9px] font-bold uppercase text-signal-red">
              Resolve details
            </span>
          ) : null}
        </button>

        {isEditable ? (
          <button
            type="button"
            onClick={() => onOpenDetails(student)}
            className={`mt-1 flex min-h-11 w-full cursor-pointer items-center justify-center border px-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] hover:bg-paper-muted ${
              record.status === 'E' && record.remarks.trim().length === 0
                ? 'border-signal-blue bg-paper-light text-signal-blue'
                : 'border-paper-dark bg-paper-light text-ink-secondary'
            }`}
          >
            {containsDetails ? 'Review details' : 'Add details'}
          </button>
        ) : null}
      </div>
    </td>
  );
}

// Keeps one semantic table model across desktop and narrow horizontal-scroll layouts.
export function AttendanceRegister({
  roster,
  dateDrafts,
  selectedDate,
  isEditing,
  liveMessage,
  onSelectDate,
  onCycleStatus,
  onOpenDetails,
}: AttendanceRegisterProps) {
  const selectedDraft = dateDrafts.find((dateDraft) => dateDraft.date === selectedDate);
  const selectedDateLabel = formatAttendanceDateShort(selectedDate);

  return (
    <section className="min-w-0 max-w-full" aria-labelledby="attendance-register-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            04 / Attendance matrix
          </p>
          <h2 id="attendance-register-heading" className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Class register
          </h2>
        </div>
        <p className="max-w-lg text-sm leading-6 text-ink-muted">
          Select a date header to review it. Only the selected date can be edited.
        </p>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>

      <div className="max-h-[70vh] max-w-full overflow-auto border border-ink bg-paper-light">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">
            Attendance register with a sticky student identity column, chronological date columns, and selected-date remarks and proof details.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-40 w-44 min-w-44 border-r border-b border-ink bg-paper-muted px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink md:w-60 md:min-w-60 md:px-4"
              >
                Student
              </th>
              {dateDrafts.map((dateDraft) => {
                const isSelected = dateDraft.date === selectedDate;
                return (
                  <th
                    key={dateDraft.date}
                    scope="col"
                    className={`sticky top-0 z-20 w-28 min-w-28 border-r border-b border-ink bg-paper-muted p-0 text-center ${
                      isSelected ? 'border-x-2 border-x-ink' : ''
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${formatAttendanceDateLong(dateDraft.date)}${isSelected ? ', selected' : '. Activate to select this date.'}`}
                      onClick={() => onSelectDate(dateDraft.date)}
                      className="flex min-h-16 w-full cursor-pointer flex-col items-center justify-center px-2 py-2 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink hover:bg-paper-dark"
                    >
                      <span>{formatAttendanceDateShort(dateDraft.date)}</span>
                      {isSelected ? (
                        <span className="mt-1 border-t border-ink pt-1 text-[9px] tracking-[0.12em]">Selected</span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
              <th
                scope="col"
                className="sticky top-0 right-48 z-40 hidden w-56 min-w-56 border-r border-b border-l-2 border-ink bg-paper-muted px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink xl:table-cell"
              >
                <span className="block">Remarks</span>
                <span className="mt-1 block text-[10px] text-ink-muted">{selectedDateLabel}</span>
              </th>
              <th
                scope="col"
                className="sticky top-0 right-0 z-40 hidden w-48 min-w-48 border-b border-ink bg-paper-muted px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink xl:table-cell"
              >
                <span className="block">Proof</span>
                <span className="mt-1 block text-[10px] text-ink-muted">{selectedDateLabel}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roster.map((student) => {
              const selectedRecord = selectedDraft?.records[student.id] ?? EMPTY_RECORD;
              return (
                <tr key={student.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-44 min-w-44 border-r border-b border-paper-border bg-paper-light px-3 py-3 align-top md:w-60 md:min-w-60 md:px-4"
                  >
                    <span className="block break-words text-sm font-semibold leading-5 text-ink">
                      {student.lastName}, {student.firstName}
                    </span>
                    {student.studentNo ? (
                      <span className="mt-1 block break-words font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                        {student.studentNo}
                      </span>
                    ) : null}
                  </th>

                  {dateDrafts.map((dateDraft) => (
                    <AttendanceStatusCell
                      key={dateDraft.date}
                      student={student}
                      dateDraft={dateDraft}
                      isSelected={dateDraft.date === selectedDate}
                      isEditing={isEditing}
                      onSelectDate={onSelectDate}
                      onCycleStatus={onCycleStatus}
                      onOpenDetails={onOpenDetails}
                    />
                  ))}

                  <td className="sticky right-48 z-10 hidden w-56 min-w-56 border-r border-b border-l-2 border-ink bg-paper-light p-1.5 xl:table-cell">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(student)}
                      className="flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-sm text-ink-secondary hover:bg-paper-muted"
                    >
                      <span className="block max-w-48 truncate">
                        {selectedRecord.remarks.trim() || 'Add remark'}
                      </span>
                    </button>
                  </td>
                  <td className="sticky right-0 z-10 hidden w-48 min-w-48 border-b border-paper-border bg-paper-light p-1.5 xl:table-cell">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(student)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm text-ink-secondary hover:bg-paper-muted"
                      title={selectedRecord.proof?.name}
                    >
                      {selectedRecord.proof ? <PaperclipIcon /> : null}
                      <span className="block max-w-36 truncate">
                        {selectedRecord.proof?.name ?? 'Add proof'}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
