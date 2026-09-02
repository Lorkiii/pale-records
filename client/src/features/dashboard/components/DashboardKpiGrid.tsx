// Renders compact high-level academic KPI cards from persisted Dashboard counts.
import type { DashboardKpis } from '../dashboard-types';

interface DashboardKpiGridProps {
  kpis: DashboardKpis;
}

// Formats the measured monthly change without inventing a comparison when data is absent.
function getAttendanceChange(change: number | null) {
  if (change === null) return undefined;
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${change.toFixed(1)} pts vs previous month`;
}

export function DashboardKpiGrid({ kpis }: DashboardKpiGridProps) {
  const items = [
    {
      id: 'attendance-rate',
      code: '01/KPI',
      label: 'Overall Attendance',
      value: kpis.overallPresentRate === null
        ? '—'
        : `${kpis.overallPresentRate.toFixed(1)}%`,
      change: getAttendanceChange(kpis.changeVsPreviousMonth),
      changeType: kpis.changeVsPreviousMonth === null || kpis.changeVsPreviousMonth === 0
        ? 'neutral'
        : kpis.changeVsPreviousMonth > 0 ? 'positive' : 'negative',
      description: kpis.overallPresentRate === null
        ? 'No marked attendance this month'
        : 'Across active classes this month',
    },
    {
      id: 'enrolled-students',
      code: '02/KPI',
      label: 'Enrolled Students',
      value: String(kpis.enrolledStudentCount),
      change: `${kpis.activeClassCount} active ${kpis.activeClassCount === 1 ? 'class' : 'classes'}`,
      changeType: 'neutral',
      description: 'Unique students in active class rosters',
    },
    {
      id: 'upcoming-events',
      code: '03/KPI',
      label: 'Upcoming Events',
      value: String(kpis.upcomingEventCount),
      change: 'Next 7 days',
      changeType: 'neutral',
      description: 'Incomplete Agenda events in range',
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((kpi, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C
        return (
          <div
            key={kpi.id}
            className="relative flex flex-col justify-between border border-ink bg-paper-light p-3.5 transition-colors hover:border-black"
          >
            {/* Corner crosshairs */}
            <span className="pointer-events-none absolute -top-1.5 -left-1.5 select-none font-mono text-[9px] font-bold leading-none text-ink">
              +
            </span>
            <span className="pointer-events-none absolute -top-1.5 -right-1.5 select-none font-mono text-[9px] font-bold leading-none text-ink">
              +
            </span>

            <div>
              <div className="flex items-center justify-between border-b border-paper-border pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="bg-ink px-1.5 py-0.2 font-mono text-[10px] font-bold text-paper-light">
                    {letter}
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    {kpi.label}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-ink-faint">{kpi.code}</span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {kpi.value}
                </p>
                {kpi.change ? (
                  <span className="inline-flex items-center gap-1 border border-paper-border bg-paper-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-secondary">
                    {kpi.changeType === 'positive' && (
                      <span className="text-signal-emerald" aria-hidden="true">
                        ↑
                      </span>
                    )}
                    {kpi.changeType === 'negative' && (
                      <span className="text-signal-red" aria-hidden="true">
                        ↓
                      </span>
                    )}
                    <span>{kpi.change}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-2 border-t border-paper-border pt-1.5">
              <p className="font-sans text-[11px] leading-4 text-ink-muted truncate">{kpi.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
