// Renders compact recent audit activity records and a space-saving directory snapshot.
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../../components/ui/Panel';
import type { ClassAttendanceStat, RecentActivityItem } from '../dashboard-types';

interface DashboardRecentActivityProps {
  recentActivity: RecentActivityItem[];
  classes: ClassAttendanceStat[];
}

export function DashboardRecentActivity({
  recentActivity,
  classes,
}: DashboardRecentActivityProps) {
  const navigate = useNavigate();

  const getActivityIcon = (type: RecentActivityItem['type']) => {
    switch (type) {
      case 'attendance':
        return (
          <span className="flex h-4 w-4 items-center justify-center border border-signal-emerald/40 bg-signal-emerald/10 text-signal-emerald">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        );
      case 'recitation':
        return (
          <span className="flex h-4 w-4 items-center justify-center border border-signal-purple/40 bg-signal-purple/10 text-signal-purple">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
        );
      case 'agenda':
        return (
          <span className="flex h-4 w-4 items-center justify-center border border-signal-blue/40 bg-signal-blue/10 text-signal-blue">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="0" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
        );
      case 'student':
        return (
          <span className="flex h-4 w-4 items-center justify-center border border-signal-amber/40 bg-signal-amber/10 text-signal-amber">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </span>
        );
      default:
        return (
          <span className="flex h-4 w-4 items-center justify-center border border-ink bg-paper text-ink">
            <span className="font-mono text-[9px]">•</span>
          </span>
        );
    }
  };

  return (
    <section aria-labelledby="activity-directory-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper-light">
            04
          </span>
          <h2 id="activity-directory-heading" className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
            Records Log & Class Directory
          </h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Recent Activity Timeline */}
        <div className="lg:col-span-5">
          <Panel
            header="Recent Log"
            sectionNumber="A"
            showCrosshairs={false}
            className="bg-paper-light"
            noPadding
          >
            <div className="max-h-56 divide-y divide-paper-border overflow-y-auto">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2.5 px-3 py-2 hover:bg-paper transition-colors"
                >
                  <div className="shrink-0 mt-0.5">{getActivityIcon(activity.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-sans text-[11px] font-semibold text-ink truncate">
                        {activity.title}
                      </p>
                      <span className="shrink-0 font-mono text-[9px] text-ink-faint">
                        {activity.timestamp}
                      </span>
                    </div>
                    <p className="font-sans text-[10px] text-ink-secondary leading-tight truncate">
                      {activity.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Active Classes Quick Roster Table */}
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
                className="font-mono text-[10px] font-bold uppercase text-ink underline hover:text-neutral-700 cursor-pointer"
              >
                All ({classes.length}) →
              </button>
            }
          >
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-paper-border bg-paper-muted sticky top-0 z-10">
                    <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink">Code</th>
                    <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink">Subject</th>
                    <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink">Section</th>
                    <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink text-center">Roster</th>
                    <th className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-ink text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-border">
                  {classes.map((c) => (
                    <tr
                      key={c.classId}
                      className="hover:bg-paper transition-colors"
                    >
                      <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-ink">
                        {c.subjectCode}
                      </td>
                      <td className="px-3 py-1.5 font-sans text-[11px] text-ink-secondary truncate max-w-40">
                        {c.subjectName}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-ink-muted">
                        {c.section}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-center text-ink">
                        {c.enrolledCount}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/attendance')}
                          className="border border-ink bg-paper-light px-2 py-0.2 font-mono text-[9px] font-bold uppercase text-ink hover:bg-ink hover:text-paper-light transition-colors cursor-pointer"
                        >
                          Register
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
