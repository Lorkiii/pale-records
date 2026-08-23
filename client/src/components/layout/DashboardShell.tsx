// Provides responsive navigation and signed-in account chrome for dashboard pages.
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import type { AuthenticatedUser } from '../../features/auth/auth-api';
import { DashboardSidebar } from './DashboardSidebar';
import { DASHBOARD_NAVIGATION } from './dashboard-navigation';
import { UserProfile } from './UserProfile';

interface DashboardShellProps {
  currentUser: AuthenticatedUser;
}

// Frames nested dashboard pages with responsive navigation and authenticated identity.
export function DashboardShell({ currentUser }: DashboardShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const location = useLocation();
  const currentSection = DASHBOARD_NAVIGATION.find((item) => item.to === location.pathname)?.label ?? 'Workspace';

  useEffect(() => {
    if (!isNavigationOpen) {
      return undefined;
    }

    // Gives keyboard users an Escape shortcut for dismissing the mobile navigation drawer.
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavigationOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isNavigationOpen]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <DashboardSidebar />
      </div>

      {isNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 cursor-default bg-ink/35"
            onClick={() => setIsNavigationOpen(false)}
          />
          <div id="mobile-dashboard-navigation" className="relative h-full w-[min(18rem,88vw)]">
            <DashboardSidebar onNavigate={() => setIsNavigationOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 border-b border-ink bg-paper px-4 py-3 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-controls="mobile-dashboard-navigation"
              aria-expanded={isNavigationOpen}
              aria-label="Open navigation"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-ink bg-paper-light text-ink hover:bg-paper-muted lg:hidden"
              onClick={() => setIsNavigationOpen(true)}
            >
              <span className="flex w-4 flex-col gap-1" aria-hidden="true">
                <span className="h-px w-full bg-current" />
                <span className="h-px w-full bg-current" />
                <span className="h-px w-full bg-current" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold uppercase tracking-[-0.03em]">PALE Records</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Workspace / {currentSection}</p>
            </div>
          </div>
          <UserProfile user={currentUser} accountLabel="Administrator" />
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
