import { useEffect, useState, type ReactNode } from 'react';
import { DashboardSidebar } from './DashboardSidebar';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  useEffect(() => {
    if (!isNavigationOpen) {
      return undefined;
    }

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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink bg-paper px-4 lg:hidden">
          <button
            type="button"
            aria-controls="mobile-dashboard-navigation"
            aria-expanded={isNavigationOpen}
            aria-label="Open navigation"
            className="flex h-11 w-11 cursor-pointer items-center justify-center border border-ink bg-paper-light text-ink hover:bg-paper-muted"
            onClick={() => setIsNavigationOpen(true)}
          >
            <span className="flex w-4 flex-col gap-1" aria-hidden="true">
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
              <span className="h-px w-full bg-current" />
            </span>
          </button>
          <div className="text-right">
            <p className="font-display text-base font-bold uppercase tracking-[-0.03em]">PALE Records</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Overview</p>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
