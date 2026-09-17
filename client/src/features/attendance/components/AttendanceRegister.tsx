// Renders a selected-date mobile roster and the full Attendance history matrix.
import { Select } from '../../../components/ui/Select';
import {
  cycleAttendanceStatus,
  formatAttendanceDateLong,
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
  formatMonthDay,
  getTableDensityClasses,
  type DateFormatPreference,
  type TableDensityPreference,
} from '../../settings/preference-display';
import { DATE_REGISTER_COLUMN_CLASSES, getDateRegisterColumnClasses } from '../../../components/ui/date-register-styles';

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
  const columnClasses = getDateRegisterColumnClasses(isSelected, isEditing);

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
      className={`${DATE_REGISTER_COLUMN_CLASSES} border-r border-b border-paper-border align-top ${columnClasses.cell}`}
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
          className={`flex min-h-11 w-full cursor-pointer flex-col items-center justify-center border px-1.5 py-2 font-mono transition-colors hover:border-ink focus-visible:relative focus-visible:z-10 ${statusClassName}`}
        >
          <span className="text-lg font-bold leading-none">
            {record?.status ?? (record ? '—' : 'N/R')}
          </span>
          <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.08em] sm:inline">
            {record
              ? record.status ? ATTENDANCE_STATUS_LABELS[record.status] : 'Unmarked'
              : 'Not in roster'}
          </span>
          {record?.remarks.trim() ? (
            <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.06em] text-ink sm:inline">
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

// Presents the selected date as touch-friendly rows on phones and a history matrix above them.
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
    ? formatMonthDay(selectedDraft.sessionDate)
    : '';

  return (
    <section className="min-w-0 max-w-full" aria-labelledby="attendance-register-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            04 / Attendance matrix
          </p>
          <h2 id="attendance-register-heading" className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
            Class register
          </h2>
        </div>
        <p className="hidden max-w-lg text-sm leading-6 text-ink-muted sm:block">
          Select a date to review its saved roster or current-enrollment draft. Only that date can be edited.
        </p>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>

      {selectedDraft ? (
        <div className="space-y-3 sm:hidden">
          <Select
            label="Attendance date"
            value={selectedSessionId}
            onChange={(event) => onSelectSession(event.target.value)}
            options={sessionDrafts.map((session) => ({
              value: session.id,
              label: formatAttendanceDateLong(session.sessionDate, dateFormat),
            }))}
            hint="Save or cancel attendance edits before switching dates."
          />
          <ul className="divide-y divide-paper-border border border-ink bg-paper-light" aria-label="Selected date attendance roster">
            {roster.map((student) => {
              const record = selectedDraft.records[student.id];
              const statusClassName = record?.status
                ? STATUS_CLASS_NAMES[record.status]
                : record
                  ? 'border-paper-dark bg-paper-light text-ink-secondary'
                  : 'border-paper-border bg-paper-muted text-ink-muted';
              return (
                <li key={student.id} className={density.record}>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink">{student.lastName}, {student.firstName}</p>
                    {student.studentNo ? (
                      <p className="mt-1 break-all font-mono text-xs text-ink-secondary">{student.studentNo}</p>
                    ) : null}
                  </div>
                  {record ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-label={getStatusButtonLabel(student, selectedDraft, record, true, isEditing, dateFormat)}
                        onClick={() => isEditing ? onCycleStatus(student.id) : onOpenDetails(student)}
                        className={`min-h-11 cursor-pointer border px-3 py-2 font-mono text-xs font-semibold uppercase ${statusClassName}`}
                      >
                        {record.status ? `${record.status} / ${ATTENDANCE_STATUS_LABELS[record.status]}` : '— / Unmarked'}
                        {!isEditing ? ' · View details' : ''}
                      </button>
                      {isEditing ? (
                        <button
                          type="button"
                          aria-label={`${hasExcuseDetails(record) ? 'Review' : 'Add'} remark for ${student.firstName} ${student.lastName}`}
                          onClick={() => onOpenDetails(student)}
                          className="min-h-11 cursor-pointer border border-paper-dark bg-paper-light px-3 py-2 font-mono text-xs font-semibold uppercase text-ink-secondary hover:bg-paper-muted"
                        >
                          {hasExcuseDetails(record) ? 'Review remark' : 'Add remark'}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink-secondary">Not in this saved roster</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="hidden max-h-[70vh] max-w-full overflow-auto border border-ink bg-paper-light sm:block">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">
            Attendance register with sticky student identity, chronological date columns, selected-date remarks, and an unavailable proof boundary.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={`sticky top-0 left-0 z-40 w-36 min-w-36 border-r border-b border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink sm:w-44 sm:min-w-44 md:w-60 md:min-w-60 ${density.tableCell}`}
              >
                Student
              </th>
              {sessionDrafts.map((sessionDraft) => {
                const isSelected = sessionDraft.id === selectedSessionId;
                const columnClasses = getDateRegisterColumnClasses(isSelected, isEditing);
                return (
                  <th
                    key={sessionDraft.id}
                    scope="col"
                    className={`sticky top-0 z-20 ${DATE_REGISTER_COLUMN_CLASSES} border-r border-b border-ink p-0 text-center ${columnClasses.header}`}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${formatAttendanceDateLong(sessionDraft.sessionDate, dateFormat)}${
                        isSelected ? (isEditing ? ', selected, editing' : ', selected') : '. Activate to select this saved date.'
                      }`}
                      onClick={() => onSelectSession(sessionDraft.id)}
                      className={`flex min-h-14 w-full cursor-pointer flex-col items-center justify-center px-1 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.04em] ${columnClasses.control}`}
                    >
                      <span>{formatMonthDay(sessionDraft.sessionDate)}</span>
                      {isSelected ? (
                        <span className="mt-1 text-[11px] tracking-normal">
                          {isEditing ? 'Editing' : 'Selected'}
                        </span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
              <th
                scope="col"
                className={`sticky top-0 right-36 z-40 hidden w-40 min-w-40 border-r border-b border-l-2 border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink xl:table-cell ${density.tableCell}`}
              >
                <span className="block">Remarks</span>
                <span className="mt-1 block text-[10px] text-ink-muted">{selectedDateLabel}</span>
              </th>
              <th
                scope="col"
                className={`sticky top-0 right-0 z-40 hidden w-36 min-w-36 border-b border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink xl:table-cell ${density.tableCell}`}
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
                    className={`sticky left-0 z-10 w-36 min-w-36 border-r border-b border-paper-border bg-paper-light align-top sm:w-44 sm:min-w-44 md:w-60 md:min-w-60 ${density.tableCell}`}
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

                  <td className={`sticky right-36 z-10 hidden w-40 min-w-40 border-r border-b border-l-2 border-ink bg-paper-light xl:table-cell ${density.tableInset}`}>
                    <button
                      type="button"
                      onClick={() => onOpenDetails(student)}
                      className="flex min-h-11 w-full cursor-pointer items-center px-2 text-left text-sm text-ink-secondary hover:bg-paper-muted"
                    >
                      <span className="block max-w-32 truncate">
                        {selectedRecord?.remarks.trim() ||
                          (isEditing && selectedRecord?.status === 'E' ? 'Add remark' : 'No remark')}
                      </span>
                    </button>
                  </td>
                  <td className={`sticky right-0 z-10 hidden w-36 min-w-36 border-b border-paper-border bg-paper-muted text-xs leading-5 text-ink-muted xl:table-cell ${density.tableCell}`}>
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
