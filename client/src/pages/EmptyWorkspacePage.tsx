// Renders the honest Agenda placeholder until that workspace has an active data flow.
import { EmptyState } from '../components/ui/EmptyState';
import { Header } from '../components/ui/Header';

type EmptyWorkspaceSection = 'agenda';

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
  agenda: {
    number: '05',
    title: 'Agenda',
    description: 'Keep upcoming academic work visible and organized.',
    emptyTitle: 'No agenda items available',
    emptyDescription: 'Upcoming academic work will appear here when agenda data is available.',
  },
};

function SectionIcon() {
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
      <Header
        workspacePath="Workspace"
        workspaceTitle={content.title}
        workspaceDescription={content.description}
      />

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          <section className="border border-ink bg-paper-light p-5 sm:p-8" aria-labelledby={`${section}-empty-heading`}>
            <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {content.number} / {content.title}
            </p>
            <EmptyState
              icon={<SectionIcon />}
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
