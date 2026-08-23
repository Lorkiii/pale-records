// Composes the authenticated PALE overview from shared record panels and empty states.
import { EmptyState } from '../components/ui/EmptyState';
import { Panel } from '../components/ui/Panel';

interface WorkspaceArea {
  code: string;
  title: string;
  description: string;
}

const WORKSPACE_AREAS: WorkspaceArea[] = [
  {
    code: '01',
    title: 'Class',
    description: 'Organize class records, subjects, and sections.',
  },
  {
    code: '02',
    title: 'Attendance',
    description: 'Record and review attendance by class session.',
  },
  {
    code: '03',
    title: 'Activity',
    description: 'Review changes made across academic records.',
  },
  {
    code: '04',
    title: 'Agenda',
    description: 'Keep upcoming academic work visible and organized.',
  },
];

// Provides the record symbol used by the class overview empty state.
function RecordsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

// Provides the calendar symbol used by the agenda overview empty state.
function AgendaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

// Provides the change symbol used by the activity overview empty state.
function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 12h4l2.5-5 4 10 2.5-5h5" />
    </svg>
  );
}

// Composes the authenticated overview without inventing unavailable record data.
export function DashboardPage() {
  return (
      <div className="min-h-screen">
        <header className="border-b border-paper-border bg-paper-light">
          <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Workspace / Overview
                </p>
                <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
                  Overview
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
                  A clear starting point for classes, attendance, academic activity, and upcoming work.
                </p>
              </div>
              <div className="border-l-2 border-ink pl-4 md:max-w-56">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Academic workspace
                </p>
                <p className="mt-1 text-sm leading-5 text-ink-secondary">Class records in one organized view.</p>
              </div>
            </div>
          </div>
        </header>

        <div className="archival-grid min-h-[calc(100vh-185px)]">
          <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
            <section aria-labelledby="record-status-heading">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    01 / Record status
                  </p>
                  <h2 id="record-status-heading" className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                    Current workspace
                  </h2>
                </div>
                <span className="hidden h-px flex-1 bg-paper-dark sm:block" aria-hidden="true" />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Panel header="Class records" sectionNumber="A" showCrosshairs={false} className="bg-paper-light">
                  <EmptyState
                    icon={<RecordsIcon />}
                    title="No class data available"
                    description="Class and section summaries will appear here when records are available."
                  />
                </Panel>

                <Panel header="Agenda" sectionNumber="B" showCrosshairs={false} className="bg-paper-light">
                  <EmptyState
                    icon={<AgendaIcon />}
                    title="No agenda items to display"
                    description="Upcoming academic work will appear here when agenda items are available."
                  />
                </Panel>

                <Panel header="Recent activity" sectionNumber="C" showCrosshairs={false} className="bg-paper-light md:col-span-2 xl:col-span-1">
                  <EmptyState
                    icon={<ActivityIcon />}
                    title="No recent activity to display"
                    description="Record changes will appear here when activity data is available."
                  />
                </Panel>
              </div>
            </section>

            <section className="mt-10 border-y border-ink bg-paper-light" aria-labelledby="workspace-directory-heading">
              <div className="grid lg:grid-cols-[0.85fr_2.15fr]">
                <div className="border-b border-ink p-5 sm:p-6 lg:border-r lg:border-b-0">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    02 / Directory
                  </p>
                  <h2 id="workspace-directory-heading" className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
                    Record workspace
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-ink-secondary">
                    Use the primary navigation to move between the core areas of PALE Records.
                  </p>
                </div>

                <ol className="grid sm:grid-cols-2">
                  {WORKSPACE_AREAS.map((area) => (
                    <li key={area.code} className="border-b border-paper-border p-5 last:border-b-0 sm:p-6 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
                      <div className="flex items-start gap-4">
                        <span className="font-mono text-xs font-bold text-ink-muted">{area.code}</span>
                        <div>
                          <h3 className="font-sans text-sm font-semibold text-ink">{area.title}</h3>
                          <p className="mt-1 text-sm leading-5 text-ink-muted">{area.description}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </div>
      </div>
  );
}

export default DashboardPage;
