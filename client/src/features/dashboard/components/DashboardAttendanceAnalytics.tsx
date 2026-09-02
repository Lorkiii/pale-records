// Renders persisted class attendance rates and the current Monday-Friday aggregate.
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../../components/ui/Panel';
import type {
  DashboardAttendanceStatus,
  DashboardClassSummary,
  DashboardWeeklyAttendance,
} from '../dashboard-types';

interface DashboardAttendanceAnalyticsProps {
  classSummaries: DashboardClassSummary[];
  weeklyAttendance: DashboardWeeklyAttendance;
}

const STATUS_DETAILS: Record<DashboardAttendanceStatus, {
  label: string;
  className: string;
}> = {
  optimal: {
    label: 'OPTIMAL',
    className: 'border-signal-emerald bg-signal-emerald/10 text-signal-emerald',
  },
  moderate: {
    label: 'MODERATE',
    className: 'border-signal-amber bg-signal-amber/10 text-signal-amber',
  },
  'at-risk': {
    label: 'AT RISK',
    className: 'border-signal-red bg-signal-red/10 text-signal-red',
  },
};

// Renders the measured distribution only when a class has marked attendance.
function AttendanceMeter({ summary }: { summary: DashboardClassSummary }) {
  if (summary.presentRate === null) {
    return (
      <p className="mt-1.5 font-mono text-[10px] text-ink-muted">
        No marked attendance this month
      </p>
    );
  }

  const lateRate = summary.lateRate ?? 0;
  const excusedRate = summary.excusedRate ?? 0;
  const absentRate = summary.absentRate ?? 0;

  return (
    <div
      className="mt-1.5 flex h-1.5 w-full max-w-md overflow-hidden border border-paper-border bg-paper-muted"
      aria-label={`${summary.presentRate}% present, ${lateRate}% late, ${excusedRate}% excused, ${absentRate}% absent`}
    >
      <div className="h-full bg-signal-emerald" style={{ width: `${summary.presentRate}%` }} />
      <div className="h-full bg-signal-amber" style={{ width: `${lateRate}%` }} />
      <div className="h-full bg-signal-blue" style={{ width: `${excusedRate}%` }} />
      <div className="h-full bg-signal-red" style={{ width: `${absentRate}%` }} />
    </div>
  );
}

export function DashboardAttendanceAnalytics({
  classSummaries,
  weeklyAttendance,
}: DashboardAttendanceAnalyticsProps) {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="attendance-analytics-heading">
      <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-2">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper-light">
            03
          </span>
          <h2
            id="attendance-analytics-heading"
            className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl"
          >
            Attendance Analytics
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/attendance')}
          className="cursor-pointer font-mono text-[11px] font-bold uppercase text-ink underline hover:text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          View Full Register →
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Panel
            header="Class Attendance Performance"
            sectionNumber="A"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
            badge={
              <span className="font-mono text-[10px] font-bold text-ink">
                {classSummaries.length} {classSummaries.length === 1 ? 'Class' : 'Classes'}
              </span>
            }
          >
            {classSummaries.length === 0 ? (
              <p className="px-4 py-8 text-sm text-ink-muted">
                No active classes are available for attendance analysis.
              </p>
            ) : (
              <div className="max-h-60 divide-y divide-paper-border overflow-y-auto">
                {classSummaries.map((summary) => {
                  const status = summary.status ? STATUS_DETAILS[summary.status] : null;
                  return (
                    <div
                      key={summary.classId}
                      className="flex flex-col justify-between gap-2 px-3.5 py-2.5 transition-colors hover:bg-paper sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {summary.subjectCode ? (
                            <span className="font-mono text-xs font-bold text-ink">
                              {summary.subjectCode}
                            </span>
                          ) : null}
                          {summary.section ? (
                            <span className="font-mono text-[11px] text-ink-muted">
                              {summary.section}
                            </span>
                          ) : null}
                          {status ? (
                            <span className={`border px-1 py-0.5 font-mono text-[9px] font-bold ${status.className}`}>
                              {status.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate font-sans text-[11px] text-ink-secondary">
                          {summary.subjectName}
                        </p>
                        <AttendanceMeter summary={summary} />
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-ink">
                            {summary.presentRate === null
                              ? '—'
                              : `${summary.presentRate.toFixed(1)}%`}
                          </span>
                          <p className="font-mono text-[9px] text-ink-faint">
                            {summary.enrolledCount} enrolled
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/attendance')}
                          className="cursor-pointer border border-ink bg-paper-light px-2 py-1 font-mono text-[10px] font-bold uppercase text-ink transition-colors hover:bg-ink hover:text-paper-light focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                        >
                          Register
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel
            header="Weekly Trend (5-Day)"
            sectionNumber="B"
            showCrosshairs={false}
            className="bg-paper-light"
          >
            <div className="grid grid-cols-5 gap-1.5 pb-2">
              {weeklyAttendance.days.map((day) => {
                const barHeight = day.presentRate === null
                  ? 0
                  : Math.round((day.presentRate / 100) * 60);
                return (
                  <div key={day.dateKey} className="flex min-w-0 flex-col items-center">
                    <span className="font-mono text-[9px] font-bold text-ink">
                      {day.presentRate === null ? '—' : `${day.presentRate.toFixed(0)}%`}
                    </span>
                    <div className="relative mt-1 flex h-16 w-full max-w-8 flex-col justify-end border border-paper-border bg-paper-muted p-0.5">
                      <div
                        className="w-full bg-ink"
                        style={{ height: `${barHeight}px` }}
                        title={day.presentRate === null
                          ? `${day.dayName}: no marked attendance`
                          : `${day.dayName}: ${day.presentRate}% present`}
                      />
                    </div>
                    <span className="mt-1 font-mono text-[10px] font-bold text-ink">
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 border-t border-paper-border pt-2">
              <div className="flex items-center justify-between gap-3 font-mono text-[10px] text-ink-secondary">
                <span>Weekly rate:</span>
                <span className="text-right font-bold text-ink">
                  {weeklyAttendance.averagePresentRate === null
                    ? 'No marked records'
                    : `${weeklyAttendance.averagePresentRate.toFixed(1)}% Present`}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
