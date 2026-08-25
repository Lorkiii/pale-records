// Displays active class records and exposes their edit/archive actions.
import { useRef, type FocusEvent } from 'react';
import { CLASS_WEEKDAYS, type ClassRecord } from '../class-types';

interface ClassDirectoryProps {
  classes: ClassRecord[];
  onEdit: (classRecord: ClassRecord) => void;
  onArchive: (classRecord: ClassRecord) => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

// Formats a stored date-only value without shifting it across local time zones.
function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

// Builds the most informative available date label for a class card.
function getDateRange(classRecord: ClassRecord) {
  if (classRecord.startDate && classRecord.endDate) {
    return `${formatDate(classRecord.startDate)} – ${formatDate(classRecord.endDate)}`;
  }

  if (classRecord.startDate) {
    return `Starts ${formatDate(classRecord.startDate)}`;
  }

  if (classRecord.endDate) {
    return `Ends ${formatDate(classRecord.endDate)}`;
  }

  return null;
}

// Formats an already validated HH:mm value without Date or timezone conversion.
function formatScheduleTime(value: string) {
  const [hourValue, minute] = value.split(':');
  const hour = Number(hourValue);
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${period}`;
}

// Resolves the short ISO weekday label used by compact schedule lines.
function getWeekdayShortLabel(dayOfWeek: number) {
  return CLASS_WEEKDAYS.find((weekday) => weekday.value === dayOfWeek)?.shortLabel
    ?? String(dayOfWeek);
}

interface ClassActionsProps {
  classRecord: ClassRecord;
  onEdit: (classRecord: ClassRecord) => void;
  onArchive: (classRecord: ClassRecord) => void;
}

// Renders the per-record action menu and closes it after selection or lost focus.
function ClassActions({ classRecord, onEdit, onArchive }: ClassActionsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Prevents the native details menu from remaining open behind a dialog.
  const closeMenu = () => {
    detailsRef.current?.removeAttribute('open');
  };

  // Closes the menu before opening the selected class in the edit form.
  const handleEdit = () => {
    closeMenu();
    onEdit(classRecord);
  };

  // Closes the menu before opening archive confirmation for the selected class.
  const handleArchive = () => {
    closeMenu();
    onArchive(classRecord);
  };

  // Dismisses the native details menu when keyboard focus leaves the menu entirely.
  const handleBlur = (event: FocusEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      closeMenu();
    }
  };

  return (
    <details ref={detailsRef} className="relative" onBlur={handleBlur}>
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 border border-ink bg-paper-light px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        Actions
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-36 border border-ink bg-paper-light p-1">
        <button
          type="button"
          className="flex min-h-10 w-full cursor-pointer items-center px-3 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink hover:bg-paper-muted focus:outline-none focus-visible:bg-paper-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
          onClick={handleEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="flex min-h-10 w-full cursor-pointer items-center px-3 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em] text-signal-red hover:bg-paper-muted focus:outline-none focus-visible:bg-paper-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
          onClick={handleArchive}
        >
          Archive
        </button>
      </div>
    </details>
  );
}

// Renders active class records with their available metadata and management actions.
export function ClassDirectory({ classes, onEdit, onArchive }: ClassDirectoryProps) {
  return (
    <section aria-labelledby="class-directory-heading">
      <div className="mb-5 flex items-end gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            01 / Class directory
          </p>
          <h2 id="class-directory-heading" className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Current classes
          </h2>
        </div>
        <span className="hidden h-px flex-1 bg-paper-dark sm:block" aria-hidden="true" />
        <span className="font-mono text-xs text-ink-muted">
          {classes.length} {classes.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((classRecord, index) => {
          const dateRange = getDateRange(classRecord);
          const schedules = [...classRecord.schedules].sort(
            (first, second) => first.dayOfWeek - second.dayOfWeek,
          );
          const metadata = [
            { label: 'Section', value: classRecord.section },
            { label: 'School year', value: classRecord.schoolYear },
            { label: 'Semester', value: classRecord.semester },
            { label: 'Teacher', value: classRecord.teacher },
            { label: 'Room', value: classRecord.room },
            { label: 'Dates', value: dateRange },
          ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

          return (
            <article key={classRecord.id} className="border border-ink bg-paper-light">
              <header className="flex items-start justify-between gap-4 border-b border-ink bg-paper-muted px-5 py-4">
                <div className="min-w-0">
                  <h3 className="font-sans text-lg font-semibold leading-6 text-ink">{classRecord.subjectName}</h3>
                  {classRecord.subjectCode ? (
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">
                      {classRecord.subjectCode}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <span className="bg-ink px-2 py-1 font-mono text-[11px] font-bold text-paper-light">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <ClassActions
                    classRecord={classRecord}
                    onEdit={onEdit}
                    onArchive={onArchive}
                  />
                </div>
              </header>

              <div className="p-5">
                {metadata.length > 0 ? (
                  <dl className="space-y-3">
                    {metadata.map((entry) => (
                      <div key={entry.label} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-paper-border pb-3 last:border-b-0 last:pb-0">
                        <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                          {entry.label}
                        </dt>
                        <dd className="min-w-0 text-sm text-ink-secondary">{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm leading-6 text-ink-muted">No additional class details recorded.</p>
                )}

                <div className="mt-4 border-t border-paper-border pt-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    Weekly schedule
                  </p>
                  {schedules.length > 0 ? (
                    <ul className="mt-2 space-y-1.5" aria-label={`${classRecord.subjectName} weekly schedule`}>
                      {schedules.map((schedule) => (
                        <li key={schedule.id} className="font-mono text-xs text-ink-secondary">
                          <span className="font-semibold text-ink">{getWeekdayShortLabel(schedule.dayOfWeek)}</span>
                          {' / '}
                          {formatScheduleTime(schedule.startTime)}-{formatScheduleTime(schedule.endTime)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-muted">No weekly schedule.</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
