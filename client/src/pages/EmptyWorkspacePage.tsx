// Renders honest no-content pages for workspace modules without active data flows.
import { EmptyState } from '../components/ui/EmptyState';

type EmptyWorkspaceSection = 'attendance' | 'activity' | 'agenda';

interface EmptyWorkspacePageProps {
  section: EmptyWorkspaceSection;
}

const SECTION_CONTENT: Record<EmptyWorkspaceSection, {
  number: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = {
  attendance: {
    number: '02',
    title: 'Attendance',
    description: 'Review attendance records by class session.',
    emptyTitle: 'No attendance records available',
    emptyDescription: 'Attendance records will appear here when class sessions have recorded attendance.',
  },
  activity: {
    number: '03',
    title: 'Activity',
    description: 'Review changes made across academic records.',
    emptyTitle: 'No recent activity available',
    emptyDescription: 'Record changes will appear here when activity data is available.',
  },
  agenda: {
    number: '04',
    title: 'Agenda',
    description: 'Keep upcoming academic work visible and organized.',
    emptyTitle: 'No agenda items available',
    emptyDescription: 'Upcoming academic work will appear here when agenda data is available.',
  },
};

function SectionIcon({ section }: { section: EmptyWorkspaceSection }) {
  if (section === 'attendance') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" />
        <path d="M8 3v4M16 3v4M4 9h16M8 15l2 2 5-5" />
      </svg>
    );
  }

  if (section === 'activity') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M3 12h4l2.5-5 4 10 2.5-5h5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" />
      <path d="M8 3v4M16 3v4M8 11h8M8 15h5" />
    </svg>
  );
}

export function EmptyWorkspacePage({ section }: EmptyWorkspacePageProps) {
  const content = SECTION_CONTENT[section];

  return (
    <div className="min-h-screen">
      <header className="border-b border-paper-border bg-paper-light">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Workspace / {content.title}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">{content.description}</p>
        </div>
      </header>

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          <section className="border border-ink bg-paper-light p-5 sm:p-8" aria-labelledby={`${section}-empty-heading`}>
            <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {content.number} / {content.title}
            </p>
            <EmptyState
              icon={<SectionIcon section={section} />}
              title={content.emptyTitle}
              titleId={`${section}-empty-heading`}
              description={content.emptyDescription}
              className="min-h-72"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
