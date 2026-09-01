// Renders the daily docket with category, completion, and Class-session actions.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import type { ClassRecord } from '../../classes/class-types';
import {
  AGENDA_CATEGORY_ACCENTS,
  type AgendaEvent,
  type SyncedClassSession,
} from '../agenda-types';
import { formatDateDisplay, formatDayOfWeekName } from '../agenda-utils';
import {
  formatTime,
  getTableDensityClasses,
  type DateFormatPreference,
  type TableDensityPreference,
  type TimeFormatPreference,
} from '../../settings/preference-display';

interface AgendaDayDocketProps {
  selectedDateKey: string;
  events: AgendaEvent[];
  sessions: SyncedClassSession[];
  classes: ClassRecord[];
  dateFormat?: DateFormatPreference;
  timeFormat?: TimeFormatPreference;
  tableDensity?: TableDensityPreference;
  onAddEvent: (dateKey: string) => void;
  canAddEvent: boolean;
  onEditEvent: (event: AgendaEvent) => void;
  onDeleteEvent: (event: AgendaEvent) => void;
  onToggleCompletion: (event: AgendaEvent) => Promise<AgendaEvent>;
}

export function AgendaDayDocket({
  selectedDateKey,
  events,
  sessions,
  classes,
  dateFormat,
  timeFormat,
  tableDensity,
  onAddEvent,
  canAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleCompletion,
}: AgendaDayDocketProps) {
  const navigate = useNavigate();
  const [pendingCompletionId, setPendingCompletionId] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState('');
  const density = getTableDensityClasses(tableDensity);
  const dateHeading = formatDateDisplay(selectedDateKey, dateFormat);
  const weekdayName = formatDayOfWeekName(selectedDateKey);

  const classMap = new Map(classes.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col border border-ink bg-paper-light">
      {/* Date Header Banner */}
      <div className={`border-b border-ink bg-paper-muted ${density.surface}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Daily Docket
            </p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {dateHeading}
            </h2>
            <p className="mt-0.5 font-mono text-xs font-semibold text-ink-secondary">
              // {weekdayName} • {events.length} {events.length === 1 ? 'Event' : 'Events'} •{' '}
              {sessions.length} {sessions.length === 1 ? 'Class' : 'Classes'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={!canAddEvent}
            onClick={() => onAddEvent(selectedDateKey)}
            className="text-xs"
            leftIcon={<span className="font-mono text-sm leading-none">+</span>}
          >
            Add to Date
          </Button>
        </div>
      </div>

      <div className={`flex flex-col divide-y divide-paper-border ${density.surface}`}>
        {/* Section 01: Custom Academic Events */}
        <div className="pb-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink">
              01 / Academic Events & Milestones
            </h3>
            <span className="font-mono text-xs text-ink-muted">({events.length})</span>
          </div>

          {completionError ? (
            <div className="mb-3">
              <Notice variant="error" title="Completion not updated" onDismiss={() => setCompletionError('')}>
                {completionError}
              </Notice>
            </div>
          ) : null}

          {events.length === 0 ? (
            <div className="border border-dashed border-paper-border bg-paper p-4 text-center">
              <p className="text-xs font-mono text-ink-muted">
                No custom events or deadlines scheduled for this date.
              </p>
              <button
                type="button"
                disabled={!canAddEvent}
                onClick={() => onAddEvent(selectedDateKey)}
                className="mt-2 cursor-pointer font-mono text-xs font-semibold text-ink underline hover:text-ink-secondary disabled:cursor-not-allowed disabled:text-ink-faint"
              >
                + Schedule an event
              </button>
            </div>
          ) : (
            <div className={density.stack}>
              {events.map((evt) => {
                const accent = AGENDA_CATEGORY_ACCENTS[evt.category.accentKey];
                const linkedClass = evt.classId ? classMap.get(evt.classId) : null;

                return (
                  <div
                    key={evt.id}
                    className={`border border-ink bg-paper transition-all hover:border-black ${density.record} ${
                      evt.completedAt ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Event Category Tag */}
                        <span
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
                            accent.badgeStyle
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              accent.pipColor
                            }`}
                          />
                          {evt.category.name}
                        </span>

                        {evt.completedAt ? (
                          <span className="border border-ink bg-paper-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                            Completed
                          </span>
                        ) : null}

                        {/* Time Stamp */}
                        <span className="font-mono text-xs font-semibold text-ink">
                          {evt.isAllDay
                            ? 'ALL DAY'
                            : evt.startTime
                              ? `${formatTime(evt.startTime, timeFormat)}${evt.endTime ? ` – ${formatTime(evt.endTime, timeFormat)}` : ''}`
                              : 'TIME UNSPECIFIED'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="xs"
                          className="min-h-11"
                          disabled={pendingCompletionId !== null}
                          isLoading={pendingCompletionId === evt.id}
                          onClick={async () => {
                            setPendingCompletionId(evt.id);
                            setCompletionError('');
                            try {
                              await onToggleCompletion(evt);
                            } catch (error) {
                              setCompletionError(error instanceof Error
                                ? error.message
                                : 'Unable to update event completion.');
                            } finally {
                              setPendingCompletionId(null);
                            }
                          }}
                        >
                          {evt.completedAt ? 'Reopen' : 'Mark Complete'}
                        </Button>
                        <ActionIconButton
                          icon="edit"
                          label={`Edit ${evt.title}`}
                          tooltip="Edit Event"
                          onClick={() => onEditEvent(evt)}
                        />
                        <ActionIconButton
                          icon="delete"
                          label={`Delete ${evt.title}`}
                          tooltip="Delete Event"
                          onClick={() => onDeleteEvent(evt)}
                        />
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className={`mt-2 font-display text-base font-bold tracking-tight text-ink ${
                      evt.completedAt ? 'line-through' : ''
                    }`}>
                      {evt.title}
                    </h4>

                    {/* Linked Class / Location Metadata */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-secondary">
                      {linkedClass && (
                        <span className="inline-flex items-center gap-1 font-semibold text-ink">
                          <span className="text-ink-muted">Class:</span>
                          {linkedClass.subjectCode
                            ? `${linkedClass.subjectCode} (${linkedClass.section ?? 'Main'})`
                            : linkedClass.subjectName}
                        </span>
                      )}
                      {evt.location && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-ink-muted">Room:</span>
                          {evt.location}
                        </span>
                      )}
                    </div>

                    {/* Description Notes */}
                    {evt.description && (
                      <p className="mt-2 whitespace-pre-wrap border-t border-paper-border pt-2 text-xs leading-relaxed text-ink-secondary">
                        {evt.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 02: Synced Recurring Class Schedule */}
        <div className="pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink">
              02 / Recurring Class Schedule
            </h3>
            <span className="font-mono text-xs text-ink-muted">({sessions.length})</span>
          </div>

          {sessions.length === 0 ? (
            <div className="border border-dashed border-paper-border bg-paper p-4 text-center">
              <p className="text-xs font-mono text-ink-muted">
                No regular class sessions scheduled on this day of the week.
              </p>
            </div>
          ) : (
            <div className={density.stack}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`border border-paper-border bg-paper-light hover:border-ink transition-colors ${density.record}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink">
                          {formatTime(session.startTime, timeFormat)} – {formatTime(session.endTime, timeFormat)}
                        </span>
                        {session.section && (
                          <span className="border border-paper-border bg-paper px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-secondary uppercase">
                            Sec {session.section}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-1 font-display text-sm sm:text-base font-bold text-ink">
                        {session.subjectName}
                      </h4>
                      <p className="font-mono text-xs text-ink-muted">
                        {session.subjectCode ? `${session.subjectCode} • ` : ''}
                        {session.room ? `Room ${session.room}` : 'Room unassigned'}
                      </p>
                    </div>

                    {/* Quick navigation actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => navigate('/dashboard/attendance')}
                        className="text-[11px]"
                      >
                        Attendance
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => navigate('/dashboard/activity')}
                        className="text-[11px]"
                      >
                        Recitation
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
