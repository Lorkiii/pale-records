// Renders a selected-date mobile roster and the full Recitation history matrix.
import { RecitationCountControl } from './RecitationCountControl';
import { Select } from '../../../../components/ui/Select';
import {
  formatRecitationDateLong,
  getRecitationCountLabel,
} from "../recitation-draft";
import type {
  RecitationSessionDraft,
  RecitationStudentRecord,
  WorkingRecitationRecord,
} from "../recitation-types";
import {
  formatMonthDay,
  getTableDensityClasses,
  type DateFormatPreference,
  type TableDensityPreference,
} from "../../../settings/preference-display";
import { DATE_REGISTER_COLUMN_CLASSES, getDateRegisterColumnClasses } from '../../../../components/ui/date-register-styles';

interface RecitationRegisterProps {
  roster: RecitationStudentRecord[];
  sessionDrafts: RecitationSessionDraft[];
  selectedSessionId: string;
  isEditing: boolean;
  isBusy: boolean;
  dateFormat?: DateFormatPreference;
  tableDensity?: TableDensityPreference;
  onSelectSession: (sessionId: string) => void;
  onCountChange: (studentId: string, change: number | 'increment' | 'decrement') => void;
  onCountValidityChange: (studentId: string, isValid: boolean) => void;
  countControlRevision: number;
}

// Renders exact counts, blank cells, and historical participation without invented totals.
function RecitationCountDisplay({ record }: { record: WorkingRecitationRecord | undefined }) {
  if (!record) return <span className="text-xs text-ink-muted">N/R</span>;
  if (record.count === null) {
    return <span className="text-xs font-semibold text-ink-secondary">Count unknown</span>;
  }
  return record.count === 0 ? <span className="sr-only">No recitation</span>
    : <span className="text-lg font-bold tabular-nums leading-none">{record.count}</span>;
}

function getColumnSize(isSelected: boolean, isEditing: boolean) {
  return isSelected && isEditing ? 'w-48 min-w-48' : DATE_REGISTER_COLUMN_CLASSES;
}

// Builds a complete accessible name for selection, editing, and read-only cells.
function getCountCellLabel(
  student: RecitationStudentRecord,
  sessionDraft: RecitationSessionDraft,
  record: WorkingRecitationRecord | undefined,
  isSelected: boolean,
  isEditing: boolean,
  isBusy: boolean,
  dateFormat?: DateFormatPreference,
) {
  const studentName = `${student.lastName}, ${student.firstName}`;
  const dateLabel = formatRecitationDateLong(sessionDraft.sessionDate, dateFormat);
  const currentCount = record
    ? getRecitationCountLabel(record.count)
    : "Not in roster";
  // If the Recitation request is in progress, return the unavailable message.
  if (isBusy) {
    return `${studentName}, ${dateLabel}, ${currentCount}. Unavailable while a Recitation request is in progress.`;
  }

  // If the student is not in the roster, return the not in roster message.
  if (!record) {
    return `${studentName}, ${dateLabel}, Not in roster. Activate to select this Recitation date.`;
  }

  // If the student is selected and is editing, return the editing message.
  if (isSelected && isEditing) {
    return `${studentName}, ${dateLabel}, ${currentCount}. Edit the recitation count.`;
  }

  // If the student is not selected, return the select message.
  if (!isSelected) {
    return `${studentName}, ${dateLabel}, ${currentCount}. Activate to select this Recitation date.`;
  }

  // If the student is selected and is not editing, return the read-only message.
  return `${studentName}, ${dateLabel}, ${currentCount}. Read-only. Choose Edit Recitation to change this count.`;
}

// Keeps blank cells neutral and recorded participation visually distinct.
function getCountClassName(record: WorkingRecitationRecord | undefined) {
  if (!record) return 'border-paper-border bg-paper-muted text-ink-muted';
  return record.count !== 0
    ? 'border-signal-emerald bg-signal-emerald/10 text-ink'
    : 'border-paper-dark bg-paper-light text-ink-secondary';
}

// Presents one session cell as selectable, editable, or deliberately static.
function RecitationCountCell({
  student,
  sessionDraft,
  isSelected,
  isEditing,
  isBusy,
  dateFormat,
  tableInset,
  onSelectSession,
  onCountChange,
  onCountValidityChange,
  countControlRevision,
}: {
  student: RecitationStudentRecord;
  sessionDraft: RecitationSessionDraft;
  isSelected: boolean;
  isEditing: boolean;
  isBusy: boolean;
  dateFormat?: DateFormatPreference;
  tableInset: string;
  onSelectSession: (sessionId: string) => void;
  onCountChange: (studentId: string, change: number | 'increment' | 'decrement') => void;
  onCountValidityChange: (studentId: string, isValid: boolean) => void;
  countControlRevision: number;
}) {
  const record = sessionDraft.records[student.id];
  const isEditable = Boolean(record && isSelected && isEditing);
  const columnClasses = getDateRegisterColumnClasses(isSelected, isEditing);
  const label = getCountCellLabel(
    student,
    sessionDraft,
    record,
    isSelected,
    isEditing,
    isBusy,
    dateFormat,
  );
  const content = <RecitationCountDisplay record={record} />;
  const cellClassName = `flex min-h-11 w-full flex-col items-center justify-center border px-1 py-1.5 font-mono ${getCountClassName(record)}`;
  // Builds the count cell.
  return (
    <td
      className={`${getColumnSize(isSelected, isEditing)} border-r border-b border-paper-border align-top ${columnClasses.cell}`}>
      <div className={`${tableInset} flex justify-center`}>
        {isEditable ? (
          <RecitationCountControl
            key={countControlRevision}
            count={record ? record.count : 0}
            studentName={`${student.lastName}, ${student.firstName}`}
            dateLabel={formatRecitationDateLong(sessionDraft.sessionDate, dateFormat)}
            disabled={isBusy}
            onChange={(change) => onCountChange(student.id, change)}
            onValidityChange={(valid) => onCountValidityChange(student.id, valid)}
          />
        ) : isSelected ? (
          <div role="group" aria-label={label} className={cellClassName}>
            {content}
          </div>
        ) : (
          <button
            type="button"
            aria-label={label}
            disabled={isBusy}
            onClick={() => onSelectSession(sessionDraft.id)}
            className={`${cellClassName} cursor-pointer transition-colors hover:border-ink hover:bg-paper-muted focus-visible:relative focus-visible:z-10 disabled:cursor-not-allowed`}>
            {content}
          </button>
        )}
      </div>
    </td>
  );
}

// Presents one selected date on phones and the complete date matrix on larger screens.
export function RecitationRegister({
  roster,
  sessionDrafts,
  selectedSessionId,
  isEditing,
  isBusy,
  dateFormat,
  tableDensity,
  onSelectSession,
  onCountChange,
  onCountValidityChange,
  countControlRevision,
}: RecitationRegisterProps) {
  const density = getTableDensityClasses(tableDensity);
  const selectedDraft = sessionDrafts.find((session) => session.id === selectedSessionId);

  return (
    <section
      className="min-w-0 max-w-full"
      aria-labelledby="recitation-register-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            04 / Recitation matrix
          </p>
          <h2
            id="recitation-register-heading"
            className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
            Class Recitation register
          </h2>
        </div>
        <p className="hidden max-w-lg text-sm leading-6 text-ink-muted sm:block">
          Select a date to review its roster. Only the selected date becomes
          interactive after Edit Recitation.
        </p>
      </div>

      {selectedDraft ? (
        <div className="space-y-3 sm:hidden">
          <Select
            label="Recitation date"
            value={selectedSessionId}
            disabled={isBusy}
            onChange={(event) => onSelectSession(event.target.value)}
            options={sessionDrafts.map((session) => ({
              value: session.id,
              label: formatRecitationDateLong(session.sessionDate, dateFormat),
            }))}
            hint="Save or cancel Recitation edits before switching dates."
          />
          <ul className="divide-y divide-paper-border border border-ink bg-paper-light" aria-label="Selected date Recitation roster">
            {roster.map((student) => {
              const record = selectedDraft.records[student.id];
              const label = getCountCellLabel(student, selectedDraft, record, true, isEditing, isBusy, dateFormat);
              return (
                <li key={student.id} className={density.record}>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink">{student.lastName}, {student.firstName}</p>
                    {student.studentNo ? (
                      <p className="mt-1 break-all font-mono text-xs text-ink-secondary">{student.studentNo}</p>
                    ) : null}
                  </div>
                  {record && isEditing ? (
                    <div className="mt-3">
                      <RecitationCountControl
                        key={countControlRevision}
                        count={record.count}
                        studentName={`${student.lastName}, ${student.firstName}`}
                        dateLabel={formatRecitationDateLong(selectedDraft.sessionDate, dateFormat)}
                        disabled={isBusy}
                        onChange={(change) => onCountChange(student.id, change)}
                        onValidityChange={(valid) => onCountValidityChange(student.id, valid)}
                      />
                    </div>
                  ) : (
                    <p role="group" aria-label={label} className={`mt-3 inline-flex min-h-11 items-center border px-3 py-2 font-mono text-xs font-semibold uppercase ${getCountClassName(record)}`}>
                      <RecitationCountDisplay record={record} />
                    </p>
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
            Recitation register with sticky student identities and chronological
            date columns. Exact recitation counts, blank cells for no recitation, unknown
            historical counts, and students not in the roster are distinguished.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={`sticky top-0 left-0 z-30 w-36 min-w-36 border-r border-b border-ink bg-paper-muted font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink sm:w-44 sm:min-w-44 md:w-60 md:min-w-60 ${density.tableCell}`}>
                Student
              </th>
              {sessionDrafts.map((sessionDraft) => {
                const isSelected = sessionDraft.id === selectedSessionId;
                const columnClasses = getDateRegisterColumnClasses(isSelected, isEditing);
                const dateLabel = formatRecitationDateLong(
                  sessionDraft.sessionDate,
                  dateFormat,
                );
                return (
                  <th
                    key={sessionDraft.id}
                    scope="col"
                    className={`sticky top-0 z-20 ${getColumnSize(isSelected, isEditing)} border-r border-b border-ink p-0 text-center ${columnClasses.header}`}>
                    {isSelected ? (
                      <div
                        aria-current="date"
                        className="flex min-h-14 w-full flex-col items-center justify-center px-1 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.04em]">
                        <span>
                          {formatMonthDay(sessionDraft.sessionDate)}
                        </span>
                        <span className="mt-1 text-[11px] tracking-normal">
                          {isEditing ? 'Editing' : 'Selected'}
                        </span>
                        <span className="sr-only">{dateLabel}, selected</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={
                          isBusy
                            ? `${dateLabel}. Date selection is unavailable while a Recitation request is in progress.`
                            : `${dateLabel}. Activate to select this Recitation date.`
                        }
                        disabled={isBusy}
                        onClick={() => onSelectSession(sessionDraft.id)}
                        className={`flex min-h-14 w-full cursor-pointer flex-col items-center justify-center px-1 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.04em] disabled:cursor-not-allowed ${columnClasses.control}`}>
                        <span>
                          {formatMonthDay(sessionDraft.sessionDate)}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roster.map((student) => (
              <tr key={student.id}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 w-36 min-w-36 border-r border-b border-paper-border bg-paper-light align-top sm:w-44 sm:min-w-44 md:w-60 md:min-w-60 ${density.tableCell}`}>
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
                  <RecitationCountCell
                    key={sessionDraft.id}
                    student={student}
                    sessionDraft={sessionDraft}
                    isSelected={sessionDraft.id === selectedSessionId}
                    isEditing={isEditing}
                    isBusy={isBusy}
                    dateFormat={dateFormat}
                    tableInset={density.tableInset}
                    onSelectSession={onSelectSession}
                    onCountChange={onCountChange}
                    onCountValidityChange={onCountValidityChange}
                    countControlRevision={countControlRevision}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
