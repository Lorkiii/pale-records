// Renders the responsive Attendance matrix for saved history and current-roster drafts.
import {
  cycleAttendanceStatus,
  formatAttendanceDateLong,
  formatAttendanceDateShort,
  hasExcuseDetails,
} from '../attendance-draft';
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceSessionDraft,
  type AttendanceStatusCode,
  type AttendanceStudentRecord,
  type WorkingAttendanceRecord,
} from '../attendance-types';
import {
  getTableDensityClasses,
  type DateFormatPreference,
  type TableDensityPreference,
} from '../../settings/preference-display';

interface AttendanceRegisterProps {
  roster: AttendanceStudentRecord[];
  sessionDrafts: AttendanceSessionDraft[];
  selectedSessionId: string;
  isEditing: boolean;
  liveMessage: string;
  dateFormat?: DateFormatPreference;
  tableDensity?: TableDensityPreference;
  onSelectSession: (sessionId: string) => void;
  onCycleStatus: (studentId: string) => void;
  onOpenDetails: (student: AttendanceStudentRecord) => void;
}

const STATUS_CLASS_NAMES: Record<AttendanceStatusCode, string> = {
  P: 'border-signal-emerald bg-signal-emerald/10 text-signal-emerald',
  A: 'border-signal-red bg-signal-red/10 text-signal-red',
  L: 'border-signal-amber bg-signal-amber/10 text-signal-amber',
  E: 'border-signal-blue bg-signal-blue/10 text-signal-blue',
};

// Builds a complete accessible label for a persisted, missing-roster, or editable cell.
function getStatusButtonLabel(
  student: AttendanceStudentRecord,
  sessionDraft: AttendanceSessionDraft,
  record: WorkingAttendanceRecord | undefined,
  isSelected: boolean,
  isEditable: boolean,
  dateFormat?: DateFormatPreference,
) {
  const studentName = `${student.lastName}, ${student.firstName}`;
  const dateLabel = formatAttendanceDateLong(sessionDraft.sessionDate, dateFormat);

  if (!record) {
    return `${studentName}, ${dateLabel}, not included in this saved roster. Activate to select this date.`;
  }

  const currentStatus = record.status ? ATTENDANCE_STATUS_LABELS[record.status] : 'Unmarked';
  if (isEditable) {
    const nextStatus = cycleAttendanceStatus(record.status);
    return `${studentName}, ${dateLabel}, ${currentStatus}. Activate to change to ${ATTENDANCE_STATUS_LABELS[nextStatus]}.`;
  }

  if (!isSelected) {
    return `${studentName}, ${dateLabel}, ${currentStatus}. Read-only. Activate to select this date.`;
  }

  return `${studentName}, ${dateLabel}, ${currentStatus}. Read-only. Activate to review attendance details.`;
}

// Presents one snapshotted record while keeping selection and editing responsibilities explicit.
function AttendanceStatusCell({
  student,
  sessionDraft,
  isSelected,
  isEditing,
  dateFormat,
  tableInset,
  onSelectSession,
  onCycleStatus,
  onOpenDetails,
}: {
  student: AttendanceStudentRecord;
  sessionDraft: AttendanceSessionDraft;
  isSelected: boolean;
  isEditing: boolean;
  dateFormat?: DateFormatPreference;
  tableInset: string;
  onSelectSession: (sessionId: string) => void;
  onCycleStatus: (studentId: string) => void;
  onOpenDetails: (student: AttendanceStudentRecord) => void;
}) {
  const record = sessionDraft.records[student.id];
  const isEditable = Boolean(record && isSelected && isEditing);
  const statusClassName = record?.status
    ? STATUS_CLASS_NAMES[record.status]
    : record
      ? 'border-paper-dark bg-paper-light text-ink-secondary'
      : 'border-paper-border bg-paper-muted text-ink-faint';
  const containsDetails = record ? hasExcuseDetails(record) : false;

  // Selects another session, cycles a working value, or opens the selected read-only detail.
  const handleStatusClick = () => {
    if (!isSelected) {
      onSelectSession(sessionDraft.id);
    } else if (record && isEditing) {
      onCycleStatus(student.id);
    } else if (record) {
      onOpenDetails(student);
    }
  };

  return (
    <td
      className={`w-28 min-w-28 border-r border-b border-paper-border align-top ${
        isSelected ? 'border-x-2 border-x-ink bg-paper-muted' : 'bg-paper-light'
      }`}
    >
      <div className={tableInset}>
        <button
          type="button"
          aria-label={getStatusButtonLabel(
            student,
            sessionDraft,
            record,
            isSelected,
            isEditable,
            dateFormat,
          )}
          onClick={handleStatusClick}
          className={`flex min-h-11 w-full cursor-pointer flex-col items-center justify-center border px-2 py-2 font-mono transition-colors hover:border-ink focus-visible:relative focus-visible:z-10 ${statusClassName}`}
        >
          <span className="text-lg font-bold leading-none">
            {record?.status ?? (record ? '—' : 'N/R')}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
            {record
              ? record.status ? ATTENDANCE_STATUS_LABELS[record.status] : 'Unmarked'
              : 'Not in roster'}
          </span>
          {record?.remarks.trim() ? (
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
              Remark
            </span>
          ) : null}
        </button>

        {isEditable && record ? (
          <button
            type="button"
            onClick={() => onOpenDetails(student)}
            className={`mt-1 flex min-h-11 w-full cursor-pointer items-center justify-center border px-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] hover:bg-paper-muted ${
              record.status === 'E' && record.remarks.trim().length === 0
                ? 'border-signal-blue bg-paper-light text-signal-blue'
                : 'border-paper-dark bg-paper-light text-ink-secondary'
            }`}
          >
            {containsDetails ? 'Review remark' : 'Add remark'}
          </button>
        ) : null}
      </div>
    </td>
  );
}

// Keeps one semantic table model across desktop and narrow horizontal-scroll layouts.
export function AttendanceRegister({
  roster,
  sessionDrafts,
  selectedSessionId,
  isEditing,
  liveMessage,
  dateFormat,
  tableDensity,
  onSelectSession,
  onCycleStatus,
  onOpenDetails,
}: AttendanceRegisterProps) {
  const density = getTableDensityClasses(tableDensity);
  const selectedDraft = sessionDrafts.find((session) => session.id === selectedSessionId);
  const selectedDateLabel = selectedDraft
    ? formatAttendanceDateShort(selectedDraft.sessionDate, dateFormat)
    : '';

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
          Select a date to review its saved roster or current-enrollment draft. Only that date can be edited.
        </p>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>

      <div className="max-h-[70vh] max-w-full overflow-auto border border-ink bg-paper-light">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">
            Attendance register with sticky student identity, chronological date columns, selected-date remarks, and an unavailable proof boundary.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={`sticky top-0 left-0 z-40 w-44 min-w-44 border-r border-b border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink md:w-60 md:min-w-60 ${density.tableCell}`}
              >
                Student
              </th>
              {sessionDrafts.map((sessionDraft) => {
                const isSelected = sessionDraft.id === selectedSessionId;
                return (
                  <th
                    key={sessionDraft.id}
                    scope="col"
                    className={`sticky top-0 z-20 w-28 min-w-28 border-r border-b border-ink bg-paper-muted p-0 text-center ${
                      isSelected ? 'border-x-2 border-x-ink' : ''
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${formatAttendanceDateLong(sessionDraft.sessionDate, dateFormat)}${
                        isSelected ? ', selected' : '. Activate to select this saved date.'
                      }`}
                      onClick={() => onSelectSession(sessionDraft.id)}
                      className="flex min-h-16 w-full cursor-pointer flex-col items-center justify-center px-2 py-2 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink hover:bg-paper-dark"
                    >
                      <span>{formatAttendanceDateShort(sessionDraft.sessionDate, dateFormat)}</span>
                      {isSelected ? (
                        <span className="mt-1 border-t border-ink pt-1 text-[9px] tracking-[0.12em]">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
              <th
                scope="col"
                className={`sticky top-0 right-48 z-40 hidden w-56 min-w-56 border-r border-b border-l-2 border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink xl:table-cell ${density.tableCell}`}
              >
                <span className="block">Remarks</span>
                <span className="mt-1 block text-[10px] text-ink-muted">{selectedDateLabel}</span>
              </th>
              <th
                scope="col"
                className={`sticky top-0 right-0 z-40 hidden w-48 min-w-48 border-b border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink xl:table-cell ${density.tableCell}`}
              >
                <span className="block">Proof</span>
                <span className="mt-1 block text-[10px] text-ink-muted">Unavailable</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roster.map((student) => {
              const selectedRecord = selectedDraft?.records[student.id];
              return (
                <tr key={student.id}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 w-44 min-w-44 border-r border-b border-paper-border bg-paper-light align-top md:w-60 md:min-w-60 ${density.tableCell}`}
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

                  {sessionDrafts.map((sessionDraft) => (
                    <AttendanceStatusCell
                      key={sessionDraft.id}
                      student={student}
                      sessionDraft={sessionDraft}
                      isSelected={sessionDraft.id === selectedSessionId}
                      isEditing={isEditing}
                      dateFormat={dateFormat}
                      tableInset={density.tableInset}
                      onSelectSession={onSelectSession}
                      onCycleStatus={onCycleStatus}
                      onOpenDetails={onOpenDetails}
                    />
                  ))}

                  <td className={`sticky right-48 z-10 hidden w-56 min-w-56 border-r border-b border-l-2 border-ink bg-paper-light xl:table-cell ${density.tableInset}`}>
                    <button
                      type="button"
                      onClick={() => onOpenDetails(student)}
                      className="flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-sm text-ink-secondary hover:bg-paper-muted"
                    >
                      <span className="block max-w-48 truncate">
                        {selectedRecord?.remarks.trim() ||
                          (isEditing && selectedRecord?.status === 'E' ? 'Add remark' : 'No remark')}
                      </span>
                    </button>
                  </td>
                  <td className={`sticky right-0 z-10 hidden w-48 min-w-48 border-b border-paper-border bg-paper-muted text-sm text-ink-muted xl:table-cell ${density.tableCell}`}>
                    Protected storage required
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
