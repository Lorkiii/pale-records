// Renders compact, scrollable class attendance performance meters and mini weekly trend charts.
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../../components/ui/Panel';
import type {
  ClassAttendanceStat,
  WeeklyAttendanceTrend,
} from '../dashboard-types';

interface DashboardAttendanceAnalyticsProps {
  classStats: ClassAttendanceStat[];
  weeklyTrends: WeeklyAttendanceTrend[];
}

export function DashboardAttendanceAnalytics({
  classStats,
  weeklyTrends,
}: DashboardAttendanceAnalyticsProps) {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="attendance-analytics-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper-light">
            03
          </span>
          <h2 id="attendance-analytics-heading" className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
            Attendance Analytics
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/attendance')}
          className="font-mono text-[11px] font-bold uppercase text-ink underline hover:text-neutral-700 cursor-pointer"
        >
          View Full Register →
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Class Attendance Rates Panel (Scrollable, Compact) */}
        <div className="lg:col-span-8">
          <Panel
            header="Class Attendance Performance"
            sectionNumber="A"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
            badge={
              <span className="font-mono text-[10px] font-bold text-ink">
                {classStats.length} Classes Tracked
              </span>
            }
          >
            <div className="max-h-60 divide-y divide-paper-border overflow-y-auto">
              {classStats.map((item) => {
                const statusBadgeStyle = {
                  optimal: 'border-signal-emerald text-signal-emerald bg-signal-emerald/10',
                  moderate: 'border-signal-amber text-signal-amber bg-signal-amber/10',
                  'at-risk': 'border-signal-red text-signal-red bg-signal-red/10',
                }[item.status];

                const statusLabel = {
                  optimal: 'OPTIMAL',
                  moderate: 'MODERATE',
                  'at-risk': 'AT RISK',
                }[item.status];

                return (
                  <div
                    key={item.classId}
                    className="flex flex-col justify-between gap-2 px-3.5 py-2.5 hover:bg-paper transition-colors sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink">
                          {item.subjectCode}
                        </span>
                        <span className="font-mono text-[11px] text-ink-muted">
                          {item.section}
                        </span>
                        <span
                          className={`border px-1 py-0.1 font-mono text-[9px] font-bold ${statusBadgeStyle}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-sans text-[11px] text-ink-secondary">
                        {item.subjectName}
                      </p>

                      {/* Compact Progress Bar */}
                      <div className="mt-1.5 flex h-1.5 w-full max-w-md overflow-hidden border border-paper-border bg-paper-muted">
                        <div
                          className="bg-signal-emerald h-full transition-all duration-300"
                          style={{ width: `${item.presentRate}%` }}
                          title={`Present: ${item.presentRate}%`}
                        />
                        <div
                          className="bg-signal-amber h-full transition-all duration-300"
                          style={{ width: `${item.lateRate}%` }}
                          title={`Late: ${item.lateRate}%`}
                        />
                        <div
                          className="bg-signal-blue h-full transition-all duration-300"
                          style={{ width: `${item.excusedRate}%` }}
                          title={`Excused: ${item.excusedRate}%`}
                        />
                        <div
                          className="bg-signal-red h-full transition-all duration-300"
                          style={{ width: `${item.absentRate}%` }}
                          title={`Absent: ${item.absentRate}%`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-ink">
                          {item.presentRate.toFixed(1)}%
                        </span>
                        <p className="font-mono text-[9px] text-ink-faint">
                          {item.enrolledCount} enrolled
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/attendance')}
                        className="border border-ink bg-paper-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink hover:bg-ink hover:text-paper-light transition-colors cursor-pointer"
                      >
                        Register
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Weekly Attendance Rate (Mini Compact Visualizer) */}
        <div className="lg:col-span-4">
          <Panel
            header="Weekly Trend (5-Day)"
            sectionNumber="B"
            showCrosshairs={false}
            className="bg-paper-light"
          >
            <div>
              <div className="grid grid-cols-5 gap-1.5 pb-2">
                {weeklyTrends.map((trend) => {
                  const barHeight = Math.max(12, Math.round((trend.percentage / 100) * 60));
                  return (
                    <div key={trend.dayName} className="flex flex-col items-center">
                      <span className="font-mono text-[9px] font-bold text-ink">
                        {trend.percentage.toFixed(0)}%
                      </span>

                      {/* Mini Bar */}
                      <div className="relative mt-1 flex h-16 w-full max-w-8 flex-col justify-end border border-paper-border bg-paper-muted p-0.5">
                        <div
                          className="w-full bg-ink transition-all duration-300"
                          style={{ height: `${barHeight}px` }}
                        />
                      </div>

                      <span className="mt-1 font-mono text-[10px] font-bold text-ink">
                        {trend.dayName}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 border-t border-paper-border pt-2">
                <div className="flex items-center justify-between font-mono text-[10px] text-ink-secondary">
                  <span>Daily Avg:</span>
                  <span className="font-bold text-ink">92.0% Present</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
