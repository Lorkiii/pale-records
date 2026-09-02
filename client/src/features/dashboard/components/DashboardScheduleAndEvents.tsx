// Renders today's persisted class schedule and the authenticated user's upcoming Agenda events.
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../../components/ui/Panel';
import { AGENDA_CATEGORY_ACCENTS } from '../../agenda/agenda-types';
import type {
  DashboardTodaySession,
  DashboardUpcomingEvent,
} from '../dashboard-types';

interface DashboardScheduleAndEventsProps {
  todaySessions: DashboardTodaySession[];
  upcomingEvents: DashboardUpcomingEvent[];
}

// Displays nullable class metadata without fabricating missing codes, sections, or rooms.
function ClassIdentity({ session }: { session: DashboardTodaySession }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {session.subjectCode ? (
          <span className="font-mono text-xs font-bold text-ink">
            {session.subjectCode}
          </span>
        ) : null}
        {session.section ? (
          <span className="font-mono text-[11px] text-ink-muted">
            {session.section}
          </span>
        ) : null}
        {session.room ? (
          <span className="border border-paper-border bg-paper-muted px-1 py-0.5 font-mono text-[9px] text-ink-secondary">
            {session.room}
          </span>
        ) : null}
      </div>
      <p className="truncate font-sans text-[11px] leading-tight text-ink-secondary">
        {session.subjectName}
      </p>
    </div>
  );
}

export function DashboardScheduleAndEvents({
  todaySessions,
  upcomingEvents,
}: DashboardScheduleAndEventsProps) {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="schedule-events-heading">
      <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper-light">
            02
          </span>
          <h2
            id="schedule-events-heading"
            className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl"
          >
            Today&apos;s Schedule & Upcoming Events
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/agenda')}
          className="cursor-pointer font-mono text-[11px] font-bold uppercase text-ink underline hover:text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Calendar →
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel
            header="Today's Class Schedule"
            sectionNumber="A"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
            badge={
              <span className="font-mono text-[10px] font-bold text-ink">
                {todaySessions.length} {todaySessions.length === 1 ? 'Class' : 'Classes'}
              </span>
            }
          >
            {todaySessions.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted">
                No active classes are scheduled for today.
              </p>
            ) : (
              <div className="max-h-72 divide-y divide-paper-border overflow-y-auto">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-paper"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex min-w-16 flex-col items-center justify-center border border-paper-border bg-paper px-2 py-0.5 text-center">
                        <span className="font-mono text-[11px] font-bold text-ink">
                          {session.startTime}
                        </span>
                        <span className="font-mono text-[9px] text-ink-muted">
                          {session.endTime}
                        </span>
                      </div>
                      <ClassIdentity session={session} />
                    </div>

                    {session.attendanceCompleted ? (
                      <span className="inline-flex shrink-0 items-center gap-1 border border-signal-emerald/40 bg-signal-emerald/10 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-emerald">
                        <span className="h-1.5 w-1.5 bg-signal-emerald" aria-hidden="true" />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/attendance')}
                        className="shrink-0 cursor-pointer border border-ink bg-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-paper-light transition-colors hover:bg-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                      >
                        Record
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-5">
          <Panel
            header="Upcoming Agenda"
            sectionNumber="B"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
            badge={
              <button
                type="button"
                onClick={() => navigate('/dashboard/agenda')}
                className="cursor-pointer font-mono text-[10px] font-bold uppercase text-ink underline hover:text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                + Add
              </button>
            }
          >
            {upcomingEvents.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted">
                No Agenda events fall within the next seven days.
              </p>
            ) : (
              <div className="max-h-72 divide-y divide-paper-border overflow-y-auto">
                {upcomingEvents.map((event) => {
                  const accent = AGENDA_CATEGORY_ACCENTS[event.category.accentKey];
                  return (
                    <div
                      key={event.id}
                      className={`flex items-start justify-between gap-2.5 px-3.5 py-2.5 transition-colors ${
                        event.isCompleted ? 'bg-paper-muted/40' : 'hover:bg-paper'
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 border border-ink bg-paper-light"
                          aria-hidden="true"
                        >
                          {event.isCompleted ? (
                            <span className="block h-full w-full bg-ink" />
                          ) : null}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`border px-1 py-0.5 font-mono text-[9px] font-bold ${accent.badgeStyle}`}>
                              {event.category.shortCode}
                            </span>
                            <span className="font-mono text-[10px] text-ink-muted">
                              {event.eventDate}
                            </span>
                            {event.startTime ? (
                              <span className="font-mono text-[10px] text-ink-faint">
                                • {event.startTime}
                              </span>
                            ) : null}
                            {event.isCompleted ? (
                              <span className="font-mono text-[9px] font-semibold uppercase text-ink-muted">
                                Completed
                              </span>
                            ) : null}
                          </div>
                          <h3 className={`mt-0.5 truncate font-sans text-xs font-semibold leading-tight ${
                            event.isCompleted ? 'text-ink-muted line-through' : 'text-ink'
                          }`}>
                            {event.title}
                          </h3>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/agenda')}
                        aria-label={`Open ${event.title} in Agenda`}
                        className="shrink-0 cursor-pointer px-1 font-mono text-[10px] font-semibold text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                      >
                        →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}
