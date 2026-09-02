// Renders compact, space-saving quick-action workflow shortcuts in a responsive grid layout.
import { useNavigate } from 'react-router-dom';

interface QuickActionItem {
  code: string;
  title: string;
  to: string;
  isPrimary?: boolean;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    code: '01',
    title: 'Attendance',
    to: '/dashboard/attendance',
    isPrimary: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" />
        <path d="M8 3v4M16 3v4M4 9h16M8 15l2 2 5-5" />
      </svg>
    ),
  },
  {
    code: '02',
    title: 'New Event',
    to: '/dashboard/agenda',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M12 14v4M10 16h4" />
      </svg>
    ),
  },
  {
    code: '03',
    title: 'New Class',
    to: '/dashboard/classes',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    code: '04',
    title: 'Add Student',
    to: '/dashboard/students',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </svg>
    ),
  },
  {
    code: '05',
    title: 'Recitation',
    to: '/dashboard/activity',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 12h4l2.5-5 4 10 2.5-5h5" />
      </svg>
    ),
  },
  {
    code: '06',
    title: 'Settings',
    to: '/dashboard/settings',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function DashboardQuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.code}
          type="button"
          onClick={() => navigate(action.to)}
          className={`group flex items-center justify-between gap-2 border px-3 py-2 text-left transition-colors cursor-pointer ${
            action.isPrimary
              ? 'border-ink bg-ink text-paper-light hover:bg-neutral-900 active:translate-y-[1px]'
              : 'border-paper-border bg-paper-light text-ink hover:border-ink hover:bg-paper-muted active:translate-y-[1px]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 ${
                action.isPrimary ? 'text-paper-light' : 'text-ink-secondary group-hover:text-ink'
              }`}
            >
              {action.icon}
            </span>
            <span
              className={`truncate font-mono text-[11px] font-bold uppercase tracking-wide ${
                action.isPrimary ? 'text-paper-light' : 'text-ink'
              }`}
            >
              {action.title}
            </span>
          </div>

          <span
            className={`font-mono text-[9px] ${
              action.isPrimary ? 'text-paper-muted/80' : 'text-ink-faint'
            }`}
          >
            {action.code}
          </span>
        </button>
      ))}
    </div>
  );
}
