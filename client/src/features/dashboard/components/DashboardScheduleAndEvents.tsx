// Renders compact today's scheduled classes and upcoming agenda events docket.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../../components/ui/Panel';
import { AGENDA_CATEGORY_ACCENTS } from '../../agenda/agenda-types';
import type { TodayClassSession, UpcomingAgendaEvent } from '../dashboard-types';

interface DashboardScheduleAndEventsProps {
  todaySessions: TodayClassSession[];
  upcomingEvents: UpcomingAgendaEvent[];
}

export function DashboardScheduleAndEvents({
  todaySessions,
  upcomingEvents,
}: DashboardScheduleAndEventsProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<UpcomingAgendaEvent[]>(upcomingEvents);

  const handleToggleEventComplete = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, isCompleted: !ev.isCompleted } : ev))
    );
  };

  return (
    <section aria-labelledby="schedule-events-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper-light">
            02
          </span>
          <h2 id="schedule-events-heading" className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
            Today's Schedule & Upcoming Events
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/agenda')}
          className="font-mono text-[11px] font-bold uppercase text-ink underline hover:text-neutral-700 cursor-pointer"
        >
          Calendar →
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Today's Class Schedule */}
        <div className="lg:col-span-7">
          <Panel
            header="Today's Class Schedule"
            sectionNumber="A"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
            badge={
              <span className="font-mono text-[10px] font-bold text-ink">
                {todaySessions.length} Classes
              </span>
            }
          >
            <div className="max-h-72 divide-y divide-paper-border overflow-y-auto">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-paper transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex flex-col items-center justify-center border border-paper-border bg-paper px-2 py-0.5 text-center min-w-16">
                      <span className="font-mono text-[11px] font-bold text-ink">
                        {session.startTime}
                      </span>
                      <span className="font-mono text-[9px] text-ink-muted">
                        {session.endTime}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-ink">
                          {session.subjectCode}
                        </span>
                        <span className="text-paper-border">•</span>
                        <span className="font-mono text-[11px] text-ink-muted truncate">
                          {session.section}
                        </span>
                        <span className="border border-paper-border bg-paper-muted px-1 py-0.1 font-mono text-[9px] text-ink-secondary">
                          {session.room}
                        </span>
                      </div>
                      <p className="truncate font-sans text-[11px] text-ink-secondary leading-tight">
                        {session.subjectName}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {session.attendanceCompleted ? (
                      <span className="inline-flex items-center gap-1 border border-signal-emerald/40 bg-signal-emerald/10 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-emerald">
                        <span className="h-1.5 w-1.5 bg-signal-emerald" />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/attendance')}
                        className="border border-ink bg-ink px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-paper-light hover:bg-neutral-900 transition-colors cursor-pointer"
                      >
                        Record
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right: Upcoming Agenda */}
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
                className="font-mono text-[10px] font-bold uppercase text-ink underline hover:text-neutral-700 cursor-pointer"
              >
                + Add
              </button>
            }
          >
            <div className="max-h-72 divide-y divide-paper-border overflow-y-auto">
              {events.map((event) => {
                const accent = AGENDA_CATEGORY_ACCENTS[event.accentKey] ?? AGENDA_CATEGORY_ACCENTS.INK;

                return (
                  <div
                    key={event.id}
                    className={`flex items-start justify-between gap-2.5 px-3.5 py-2.5 transition-colors ${
                      event.isCompleted ? 'bg-paper-muted/40 opacity-60' : 'hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleEventComplete(event.id)}
                        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-ink bg-paper-light hover:bg-paper-border cursor-pointer"
                        title={event.isCompleted ? 'Mark pending' : 'Mark completed'}
                        aria-label={`Toggle complete for ${event.title}`}
                      >
                        {event.isCompleted && <span className="h-2 w-2 bg-ink" />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`border px-1 py-0.1 font-mono text-[9px] font-bold ${accent.badgeStyle}`}
                          >
                            {event.categoryCode}
                          </span>
                          <span className="font-mono text-[10px] text-ink-muted">
                            {event.eventDate}
                          </span>
                          {event.startTime && (
                            <span className="font-mono text-[10px] text-ink-faint">
                              • {event.startTime}
                            </span>
                          )}
                        </div>

                        <h3
                          className={`mt-0.5 truncate font-sans text-xs font-semibold leading-tight text-ink ${
                            event.isCompleted ? 'line-through text-ink-muted' : ''
                          }`}
                        >
                          {event.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/agenda')}
                      className="shrink-0 font-mono text-[10px] font-semibold text-ink-muted hover:text-ink cursor-pointer"
                    >
                      →
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
