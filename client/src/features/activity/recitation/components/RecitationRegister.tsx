// Renders the responsive Recitation matrix for saved rosters and current-enrollment drafts.
import {
  cycleRecitationMark,
  formatRecitationDateLong,
  formatRecitationDateShort,
  getRecitationMarkLabel,
} from "../recitation-draft";
import type {
  RecitationSessionDraft,
  RecitationStudentRecord,
  WorkingRecitationRecord,
} from "../recitation-types";

interface RecitationRegisterProps {
  roster: RecitationStudentRecord[];
  sessionDrafts: RecitationSessionDraft[];
  selectedSessionId: string;
  isEditing: boolean;
  isBusy: boolean;
  onSelectSession: (sessionId: string) => void;
  onCycleMark: (studentId: string) => void;
}

// Returns visible mark content that never relies on color alone.
function getMarkDisplay(record: WorkingRecitationRecord | undefined) {
  if (!record) {
    return { symbol: "N/R", label: "Not in roster" };
  }

  if (record.mark === "CHECK") {
    return { symbol: "✓", label: "Check" };
  }

  if (record.mark === "X") {
    return { symbol: "X", label: "X" };
  }

  return { symbol: "—", label: "Unmarked" };
}

// Builds a complete accessible name for selection, editing, and read-only cells.
function getMarkCellLabel(
  student: RecitationStudentRecord,
  sessionDraft: RecitationSessionDraft,
  record: WorkingRecitationRecord | undefined,
  isSelected: boolean,
  isEditing: boolean,
  isBusy: boolean,
) {
  const studentName = `${student.lastName}, ${student.firstName}`;
  const dateLabel = formatRecitationDateLong(sessionDraft.sessionDate);
  const currentMark = record
    ? getRecitationMarkLabel(record.mark)
    : "Not in roster";
  // If the Recitation request is in progress, return the unavailable message.
  if (isBusy) {
    return `${studentName}, ${dateLabel}, ${currentMark}. Unavailable while a Recitation request is in progress.`;
  }

  // If the student is not in the roster, return the not in roster message.
  if (!record) {
    return `${studentName}, ${dateLabel}, Not in roster. Activate to select this Recitation date.`;
  }

  // If the student is selected and is editing, return the editing message.
  if (isSelected && isEditing) {
    const nextMark = getRecitationMarkLabel(cycleRecitationMark(record.mark));
    return `${studentName}, ${dateLabel}, ${currentMark}. Activate to change to ${nextMark}.`;
  }

  // If the student is not selected, return the select message.
  if (!isSelected) {
    return `${studentName}, ${dateLabel}, ${currentMark}. Activate to select this Recitation date.`;
  }

  // If the student is selected and is not editing, return the read-only message.
  return `${studentName}, ${dateLabel}, ${currentMark}. Read-only. Choose Edit Recitation to change this mark.`;
}

// Returns semantic signal styling while leaving symbols and text visible.
function getMarkClassName(record: WorkingRecitationRecord | undefined) {
  if (!record) {
    return "border-paper-border bg-paper-muted text-ink-muted";
  }

  if (record.mark === "CHECK") {
    return "border-signal-emerald bg-signal-emerald/10 text-signal-emerald";
  }

  if (record.mark === "X") {
    return "border-signal-red bg-signal-red/10 text-signal-red";
  }

  return "border-paper-dark bg-paper-light text-ink-secondary";
}

// Presents one session cell as selectable, editable, or deliberately static.
function RecitationMarkCell({
  student,
  sessionDraft,
  isSelected,
  isEditing,
  isBusy,
  onSelectSession,
  onCycleMark,
}: {
  student: RecitationStudentRecord;
  sessionDraft: RecitationSessionDraft;
  isSelected: boolean;
  isEditing: boolean;
  isBusy: boolean;
  onSelectSession: (sessionId: string) => void;
  onCycleMark: (studentId: string) => void;
}) {
  const record = sessionDraft.records[student.id];
  const isEditable = Boolean(record && isSelected && isEditing);
  const markDisplay = getMarkDisplay(record);
  const label = getMarkCellLabel(
    student,
    sessionDraft,
    record,
    isSelected,
    isEditing,
    isBusy,
  );
  // Builds the content for the mark cell.
  const content = (
    <>
      <span className="text-lg font-bold leading-none">
        {markDisplay.symbol}
      </span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em]">
        {markDisplay.label}
      </span>
    </>
  );
  const cellClassName = `flex min-h-14 w-full flex-col items-center justify-center border px-2 py-2 font-mono ${getMarkClassName(record)}`;
  // Builds the mark cell.
  return (
    <td
      className={`w-32 min-w-32 border-r border-b border-paper-border align-top ${
        isSelected ? "border-x-2 border-x-ink bg-paper-muted" : "bg-paper-light"
      }`}>
      <div className="p-1.5">
        {isEditable ? (
          <button
            type="button"
            aria-label={label}
            disabled={isBusy}
            onClick={() => onCycleMark(student.id)}
            className={`${cellClassName} cursor-pointer transition-colors hover:border-ink focus-visible:relative focus-visible:z-10 disabled:cursor-not-allowed`}>
            {content}
          </button>
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

// Keeps one semantic table across desktop and narrow horizontal-scroll layouts.
export function RecitationRegister({
  roster,
  sessionDrafts,
  selectedSessionId,
  isEditing,
  isBusy,
  onSelectSession,
  onCycleMark,
}: RecitationRegisterProps) {
  return (
    <section
      className="min-w-0 max-w-full"
      aria-labelledby="recitation-register-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            04 / Recitation matrix
          </p>
          <h2
            id="recitation-register-heading"
            className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Class Recitation register
          </h2>
        </div>
        <p className="max-w-lg text-sm leading-6 text-ink-muted">
          Select a date to review its roster. Only the selected date becomes
          interactive after Edit Recitation.
        </p>
      </div>

      <div className="max-h-[70vh] max-w-full overflow-auto border border-ink bg-paper-light">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">
            Recitation register with sticky student identities and chronological
            date columns. Check, X, Unmarked, and Not in roster are shown with
            text and symbols.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-30 w-48 min-w-48 border-r border-b border-ink bg-paper-muted px-3 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink sm:w-60 sm:min-w-60 sm:px-4">
                Student
              </th>
              {sessionDrafts.map((sessionDraft) => {
                const isSelected = sessionDraft.id === selectedSessionId;
                const dateLabel = formatRecitationDateLong(
                  sessionDraft.sessionDate,
                );
                return (
                  <th
                    key={sessionDraft.id}
                    scope="col"
                    className={`sticky top-0 z-20 w-32 min-w-32 border-r border-b border-ink bg-paper-muted p-0 text-center ${
                      isSelected ? "border-x-2 border-x-ink" : ""
                    }`}>
                    {isSelected ? (
                      <div
                        aria-current="date"
                        className="flex min-h-16 w-full flex-col items-center justify-center px-2 py-2 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink">
                        <span>
                          {formatRecitationDateShort(sessionDraft.sessionDate)}
                        </span>
                        <span className="mt-1 border-t border-ink pt-1 text-[11px] tracking-[0.12em]">
                          Selected
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
                        className="flex min-h-16 w-full cursor-pointer flex-col items-center justify-center px-2 py-2 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink hover:bg-paper-dark disabled:cursor-not-allowed">
                        <span>
                          {formatRecitationDateShort(sessionDraft.sessionDate)}
                        </span>
                        <span className="mt-1 text-[11px] tracking-[0.12em] text-ink-muted">
                          Select
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
                  className="sticky left-0 z-10 w-48 min-w-48 border-r border-b border-paper-border bg-paper-light px-3 py-3 align-top sm:w-60 sm:min-w-60 sm:px-4">
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
                  <RecitationMarkCell
                    key={sessionDraft.id}
                    student={student}
                    sessionDraft={sessionDraft}
                    isSelected={sessionDraft.id === selectedSessionId}
                    isEditing={isEditing}
                    isBusy={isBusy}
                    onSelectSession={onSelectSession}
                    onCycleMark={onCycleMark}
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
