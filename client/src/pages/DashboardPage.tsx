// Composes the authenticated Dashboard from its live overview and honest request states.
import { Button } from '../components/ui/Button';
import { Notice } from '../components/ui/Notice';
import PageLoad from '../components/ui/PageLoad';
import { DashboardAttendanceAnalytics } from '../features/dashboard/components/DashboardAttendanceAnalytics';
import { DashboardKpiGrid } from '../features/dashboard/components/DashboardKpiGrid';
import { DashboardQuickActions } from '../features/dashboard/components/DashboardQuickActions';
import { DashboardRecentActivity } from '../features/dashboard/components/DashboardRecentActivity';
import { DashboardScheduleAndEvents } from '../features/dashboard/components/DashboardScheduleAndEvents';
import { useDashboardOverview } from '../features/dashboard/useDashboardOverview';

interface DashboardPageProps {
  onSessionExpired: () => void;
}

// Renders the current local-date overview after its authenticated request resolves.
export function DashboardPage({ onSessionExpired }: DashboardPageProps) {
  const dashboard = useDashboardOverview(onSessionExpired);

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
                As of {dashboard.overview?.asOfDate ?? dashboard.asOfDate}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Archival Grid */}
      <div className="archival-grid min-h-[calc(100vh-140px)]">
        <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-4 sm:px-8 sm:py-5 xl:px-12">
          {dashboard.loadStatus === 'loading' ? (
            <PageLoad message="Loading Dashboard overview…" />
          ) : null}

          {dashboard.loadStatus === 'error' ? (
            <Notice variant="error" title="Dashboard unavailable">
              <div className="space-y-4">
                <p>{dashboard.loadError}</p>
                <Button size="sm" variant="secondary" onClick={dashboard.retry}>
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {dashboard.loadStatus === 'ready' && dashboard.overview ? (
            <>
              <div className="space-y-3">
                <DashboardKpiGrid kpis={dashboard.overview.kpis} />
                <DashboardQuickActions />
              </div>

              <DashboardScheduleAndEvents
                todaySessions={dashboard.overview.todaySessions}
                upcomingEvents={dashboard.overview.upcomingEvents}
              />

              <DashboardAttendanceAnalytics
                classSummaries={dashboard.overview.classSummaries}
                weeklyAttendance={dashboard.overview.weeklyAttendance}
              />

              <DashboardRecentActivity
                recentUpdates={dashboard.overview.recentUpdates}
                classes={dashboard.overview.classSummaries}
                activeClassCount={dashboard.overview.kpis.activeClassCount}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
