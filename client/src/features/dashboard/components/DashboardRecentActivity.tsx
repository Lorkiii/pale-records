// Renders recent persisted updates and a compact active-Class directory snapshot.
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../../components/ui/Panel';
import type {
  DashboardClassSummary,
  DashboardRecentUpdate,
  DashboardRecentUpdateType,
} from '../dashboard-types';

interface DashboardRecentActivityProps {
  recentUpdates: DashboardRecentUpdate[];
  classes: DashboardClassSummary[];
  activeClassCount: number;
}

// Formats persisted timestamps in the browser's local timezone.
function formatOccurredAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

// Provides a compact icon for each persisted entity family.
function ActivityIcon({ type }: { type: DashboardRecentUpdateType }) {
  if (type === 'attendance') {
    return (
      <span className="flex h-4 w-4 items-center justify-center border border-signal-emerald/40 bg-signal-emerald/10 text-signal-emerald">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }

  if (type === 'recitation') {
    return (
      <span className="flex h-4 w-4 items-center justify-center border border-signal-purple/40 bg-signal-purple/10 text-signal-purple">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
    );
  }

  if (type === 'agenda') {
    return (
      <span className="flex h-4 w-4 items-center justify-center border border-signal-blue/40 bg-signal-blue/10 text-signal-blue">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </span>
    );
  }

  if (type === 'student') {
    return (
      <span className="flex h-4 w-4 items-center justify-center border border-signal-amber/40 bg-signal-amber/10 text-signal-amber">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <circle cx="12" cy="8" r="5" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-4 w-4 items-center justify-center border border-ink bg-paper text-ink">
      <span className="font-mono text-[9px]" aria-hidden="true">C</span>
    </span>
  );
}

export function DashboardRecentActivity({
  recentUpdates,
  classes,
  activeClassCount,
}: DashboardRecentActivityProps) {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="updates-directory-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper-light">
            04
          </span>
          <h2
            id="updates-directory-heading"
            className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl"
          >
            Recent Updates & Class Directory
          </h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Panel
            header="Recent Updates"
            sectionNumber="A"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
          >
            {recentUpdates.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted">
                No recent persisted updates are available.
              </p>
            ) : (
              <div className="max-h-56 divide-y divide-paper-border overflow-y-auto">
                {recentUpdates.map((update) => (
                  <div
                    key={`${update.type}:${update.entityId}`}
                    className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-paper"
                  >
                    <div className="mt-0.5 shrink-0">
                      <ActivityIcon type={update.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                        <p className="truncate font-sans text-[11px] font-semibold text-ink">
                          {update.title}
                        </p>
                        <time
                          dateTime={update.occurredAt}
                          className="shrink-0 font-mono text-[9px] text-ink-faint"
                        >
                          {formatOccurredAt(update.occurredAt)}
                        </time>
                      </div>
                      {update.description ? (
                        <p className="truncate font-sans text-[10px] leading-tight text-ink-secondary">
                          {update.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-7">
          <Panel
            header="Classes Directory"
            sectionNumber="B"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
            badge={
              <button
                type="button"
                onClick={() => navigate('/dashboard/classes')}
                className="cursor-pointer font-mono text-[10px] font-bold uppercase text-ink underline hover:text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                All ({activeClassCount}) →
              </button>
            }
          >
            {classes.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted">
                No active classes are available.
              </p>
            ) : (
              <div className="max-h-56 overflow-x-auto overflow-y-auto">
                <table className="min-w-[34rem] w-full border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-paper-border bg-paper-muted">
                      <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink">Code</th>
                      <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink">Subject</th>
                      <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink">Section</th>
                      <th className="px-3 py-1.5 text-center font-mono text-[10px] font-bold uppercase text-ink">Roster</th>
                      <th className="px-3 py-1.5 text-right font-mono text-[10px] font-bold uppercase text-ink">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-border">
                    {classes.map((classSummary) => (
                      <tr key={classSummary.classId} className="transition-colors hover:bg-paper">
                        <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-ink">
                          {classSummary.subjectCode ?? '—'}
                        </td>
                        <td className="max-w-40 truncate px-3 py-1.5 font-sans text-[11px] text-ink-secondary">
                          {classSummary.subjectName}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-ink-muted">
                          {classSummary.section ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 text-center font-mono text-[10px] text-ink">
                          {classSummary.enrolledCount}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/attendance')}
                            className="cursor-pointer border border-ink bg-paper-light px-2 py-1 font-mono text-[9px] font-bold uppercase text-ink transition-colors hover:bg-ink hover:text-paper-light focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                          >
                            Register
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}
