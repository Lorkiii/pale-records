// Renders the detailed daily schedule docket for the selected calendar date.
import { useNavigate } from 'react-router-dom';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { Button } from '../../../components/ui/Button';
import type { ClassRecord } from '../../classes/class-types';
import {
  AGENDA_EVENT_TYPES,
  type AgendaEvent,
  type SyncedClassSession,
} from '../agenda-types';
import { formatDateDisplay, formatDayOfWeekName } from '../agenda-utils';

interface AgendaDayDocketProps {
  selectedDateKey: string;
  events: AgendaEvent[];
  sessions: SyncedClassSession[];
  classes: ClassRecord[];
  onAddEvent: (dateKey: string) => void;
  onEditEvent: (event: AgendaEvent) => void;
  onDeleteEvent: (event: AgendaEvent) => void;
}

export function AgendaDayDocket({
  selectedDateKey,
  events,
  sessions,
  classes,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
}: AgendaDayDocketProps) {
  const navigate = useNavigate();
  const dateHeading = formatDateDisplay(selectedDateKey);
  const weekdayName = formatDayOfWeekName(selectedDateKey);

  const classMap = new Map(classes.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col border border-ink bg-paper-light">
      {/* Date Header Banner */}
      <div className="border-b border-ink bg-paper-muted p-4 sm:p-5">
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
            onClick={() => onAddEvent(selectedDateKey)}
            className="text-xs"
            leftIcon={<span className="font-mono text-sm leading-none">+</span>}
          >
            Add to Date
          </Button>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-paper-border p-4 sm:p-5">
        {/* Section 01: Custom Academic Events */}
        <div className="pb-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink">
              01 / Academic Events & Milestones
            </h3>
            <span className="font-mono text-xs text-ink-muted">({events.length})</span>
          </div>

          {events.length === 0 ? (
            <div className="border border-dashed border-paper-border bg-paper p-4 text-center">
              <p className="text-xs font-mono text-ink-muted">
                No custom events or deadlines scheduled for this date.
              </p>
              <button
                type="button"
                onClick={() => onAddEvent(selectedDateKey)}
                className="mt-2 text-xs font-mono font-semibold text-ink underline hover:text-ink-secondary cursor-pointer"
              >
                + Schedule an event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => {
                const typeConfig = AGENDA_EVENT_TYPES.find((t) => t.type === evt.eventType);
                const linkedClass = evt.classId ? classMap.get(evt.classId) : null;

                return (
                  <div
                    key={evt.id}
                    className="border border-ink bg-paper p-3.5 sm:p-4 transition-all hover:border-black"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Event Category Tag */}
                        <span
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
                            typeConfig?.badgeStyle ?? 'border-ink text-ink bg-paper-light'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              typeConfig?.pipColor ?? 'bg-ink'
                            }`}
                          />
                          {typeConfig?.label ?? evt.eventType}
                        </span>

                        {/* Time Stamp */}
                        <span className="font-mono text-xs font-semibold text-ink">
                          {evt.isAllDay
                            ? 'ALL DAY'
                            : evt.startTime
                              ? `${evt.startTime}${evt.endTime ? ` - ${evt.endTime}` : ''}`
                              : 'TIME UNSPECIFIED'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
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
                    <h4 className="mt-2 font-display text-base font-bold tracking-tight text-ink">
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
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-paper-border bg-paper-light p-3.5 sm:p-4 hover:border-ink transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink">
                          {session.startTime} - {session.endTime}
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
