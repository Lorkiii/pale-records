import type { ReactNode, SVGProps } from 'react';

type NavigationIconName =
  | 'overview'
  | 'class'
  | 'attendance'
  | 'activity'
  | 'agenda'
  | 'settings'
  | 'logout';

interface NavigationItem {
  id: NavigationIconName;
  label: string;
}

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

const PRIMARY_NAVIGATION: NavigationItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'class', label: 'Class' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'activity', label: 'Activity' },
  { id: 'agenda', label: 'Agenda' },
];

const ICON_PATHS: Record<NavigationIconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  class: (
    <>
      <path d="m3 6 9-3 9 3-9 3-9-3Z" />
      <path d="M7 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8" />
      <path d="M21 7v6" />
    </>
  ),
  attendance: (
    <>
      <rect x="4" y="3" width="16" height="18" />
      <path d="M8 3v4M16 3v4M4 9h16" />
      <path d="m8 15 2.2 2L16 12" />
    </>
  ),
  activity: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      <path d="m4 7 6-5 6 7 5-5" />
    </>
  ),
  agenda: (
    <>
      <rect x="4" y="3" width="16" height="18" />
      <path d="M8 3v4M16 3v4M8 11h8M8 15h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" />
    </>
  ),
};

function NavigationIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: NavigationIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const navigationItemStyles =
  'group flex min-h-11 w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left font-sans text-sm font-medium transition-colors';

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-r border-ink bg-paper-muted text-ink">
      <div className="border-b border-ink px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-bold uppercase tracking-[-0.04em]">PALE Records</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary">
              Class record system
            </p>
          </div>
          <span className="mt-1 block h-3 w-3 bg-ink" aria-hidden="true" />
        </div>
      </div>

      <nav className="flex-1 px-3 py-6" aria-label="Primary navigation">
        <p className="px-4 pb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Workspace
        </p>
        <ul className="space-y-1">
          {PRIMARY_NAVIGATION.map((item) => {
            const isCurrent = item.id === 'overview';

            if (!isCurrent) {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled
                    className={`${navigationItemStyles} cursor-default border-transparent text-ink-secondary disabled:opacity-100`}
                  >
                    <NavigationIcon name={item.id} className="h-4.5 w-4.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current="page"
                  onClick={onNavigate}
                  className={`${navigationItemStyles} border-ink bg-ink text-paper-light`}
                >
                  <NavigationIcon name={item.id} className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                  <span className="ml-auto h-1.5 w-1.5 bg-paper-light" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-ink px-3 py-4">
        <p className="px-4 pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Account
        </p>
        <button
          type="button"
          disabled
          className={`${navigationItemStyles} cursor-default border-transparent text-ink-secondary disabled:opacity-100`}
        >
          <NavigationIcon name="settings" className="h-4.5 w-4.5 shrink-0" />
          <span>Settings</span>
        </button>
        <button
          type="button"
          disabled
          className={`${navigationItemStyles} cursor-default border-transparent text-ink-secondary disabled:opacity-100`}
        >
          <NavigationIcon name="logout" className="h-4.5 w-4.5 shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
