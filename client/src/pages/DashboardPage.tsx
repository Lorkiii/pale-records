// Composes the authenticated compact PALE Records Dashboard with prioritized schedule, analytics, and quick actions.
import { DashboardAttendanceAnalytics } from '../features/dashboard/components/DashboardAttendanceAnalytics';
import { DashboardKpiGrid } from '../features/dashboard/components/DashboardKpiGrid';
import { DashboardQuickActions } from '../features/dashboard/components/DashboardQuickActions';
import { DashboardRecentActivity } from '../features/dashboard/components/DashboardRecentActivity';
import { DashboardScheduleAndEvents } from '../features/dashboard/components/DashboardScheduleAndEvents';
import {
  CLASS_ATTENDANCE_STATS,
  DASHBOARD_KPIS,
  RECENT_ACTIVITY_ITEMS,
  TODAY_CLASS_SESSIONS,
  UPCOMING_AGENDA_EVENTS,
  WEEKLY_ATTENDANCE_TRENDS,
} from '../features/dashboard/dashboard-mock-data';

export function DashboardPage() {
  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      {/* Compact Dashboard Top Header */}
      <header className="border-b border-paper-border bg-paper-light">
        <div className="mx-auto max-w-[1440px] px-4 py-3.5 sm:px-8 sm:py-4 xl:px-12">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Workspace / Overview
              </p>
              <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center">
              <span className="border border-paper-border bg-paper px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-secondary">
                AY 2026-2027 • 1st Sem
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Archival Grid */}
      <div className="archival-grid min-h-[calc(100vh-140px)]">
        <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-4 sm:px-8 sm:py-5 xl:px-12">
          {/* Top Row: Compact KPIs & Quick Actions Grid */}
          <div className="space-y-3">
            <DashboardKpiGrid kpis={DASHBOARD_KPIS} />
            <DashboardQuickActions />
          </div>

          {/* Section 02 (Top Focus): Today's Schedule & Upcoming Events */}
          <DashboardScheduleAndEvents
            todaySessions={TODAY_CLASS_SESSIONS}
            upcomingEvents={UPCOMING_AGENDA_EVENTS}
          />

          {/* Section 03: Compact Attendance Analytics */}
          <DashboardAttendanceAnalytics
            classStats={CLASS_ATTENDANCE_STATS}
            weeklyTrends={WEEKLY_ATTENDANCE_TRENDS}
          />

          {/* Section 04: Compact Records Log & Class Directory */}
          <DashboardRecentActivity
            recentActivity={RECENT_ACTIVITY_ITEMS}
            classes={CLASS_ATTENDANCE_STATS}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
