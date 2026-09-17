// Provides focus-managed mobile navigation and signed-in account chrome.
import { useEffect, useRef, useState } from 'react';
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
  const navigationDialogRef = useRef<HTMLDialogElement>(null);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationCloseRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const currentSection = location.pathname.startsWith('/dashboard/settings')
    ? 'Settings'
    : (DASHBOARD_NAVIGATION.find((item) => item.to === location.pathname)?.label ?? 'Workspace');

  useEffect(() => {
    const dialog = navigationDialogRef.current;
    if (!dialog) return;

    if (isNavigationOpen && !dialog.open) {
      dialog.showModal();
      navigationCloseRef.current?.focus();
    } else if (!isNavigationOpen && dialog.open) {
      dialog.close();
      window.requestAnimationFrame(() => navigationTriggerRef.current?.focus());
    }
  }, [isNavigationOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setIsNavigationOpen(false);
    };
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <DashboardSidebar />
      </div>

      <dialog
        ref={navigationDialogRef}
        aria-label="Workspace navigation"
        className="fixed top-0 left-0 z-50 m-0 h-dvh max-h-dvh w-[min(18rem,88vw)] max-w-none border-0 bg-paper-muted p-0 text-ink backdrop:bg-ink/35 lg:hidden"
        onCancel={(event) => {
          event.preventDefault();
          setIsNavigationOpen(false);
        }}
        onClose={() => setIsNavigationOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setIsNavigationOpen(false);
        }}
      >
        <div id="mobile-dashboard-navigation" className="flex h-full min-h-0 flex-col">
          <div className="flex justify-end border-b border-ink bg-paper-light p-2">
            <button
              ref={navigationCloseRef}
              type="button"
              aria-label="Close navigation"
              onClick={() => setIsNavigationOpen(false)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center border border-ink bg-paper-light text-xl text-ink"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <DashboardSidebar onNavigate={() => setIsNavigationOpen(false)} />
          </div>
        </div>
      </dialog>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-15 items-center justify-between gap-3 border-b border-ink bg-paper px-4 py-2 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={navigationTriggerRef}
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
          <UserProfile user={currentUser} />
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
