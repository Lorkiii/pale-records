// Composes the Classes workspace from feature-owned state, actions, and dialogs.
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Header } from '../components/ui/Header';
import { Notice } from '../components/ui/Notice';
import { ArchiveClassDialog } from '../features/classes/components/ArchiveClassDialog';
import { ClassDirectory } from '../features/classes/components/ClassDirectory';
import { ClassFormDialog } from '../features/classes/components/ClassFormDialog';
import { useClassWorkspace } from '../features/classes/useClassWorkspace';

interface ClassPageProps {
  onSessionExpired: () => void;
}

// Provides the decorative class symbol used by the empty directory state.
function ClassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="m3 6 9-3 9 3-9 3-9-3Z" />
      <path d="M7 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8M21 7v6" />
    </svg>
  );
}

// Renders Classes workspace states and delegates workflow behavior to its feature hook.
export function ClassPage({ onSessionExpired }: ClassPageProps) {
  const workspace = useClassWorkspace(onSessionExpired);

  return (
    <div className="min-h-screen">
      <Header
        workspacePath="/dashboard/classes"
        workspaceTitle="Class"
        workspaceDescription="Organize subjects, sections, academic terms, teachers, rooms, and class dates."
        actionButton={
          <Button
            onClick={workspace.handleOpenCreate}
            disabled={workspace.loadStatus !== 'ready'}
          >
            Add class
          </Button>
        }
      />

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {workspace.loadStatus === 'loading' ? (
            <div className="border border-ink bg-paper-light px-5 py-10 text-center">
              <p
                role="status"
                className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted"
              >
                Loading class directory…
              </p>
            </div>
          ) : null}

          {workspace.loadStatus === 'error' ? (
            <Notice variant="error" title="Class directory unavailable">
              <div className="space-y-4">
                <p>{workspace.loadError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={workspace.handleRetryLoad}
                >
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {workspace.loadStatus === 'ready' && workspace.classes.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<ClassIcon />}
                title="No classes available"
                description="Add the first class to begin organizing its subject and academic details."
                action={
                  <Button onClick={workspace.handleOpenCreate}>
                    Add class
                  </Button>
                }
                className="min-h-72"
              />
            </div>
          ) : null}

          {workspace.loadStatus === 'ready' && workspace.classes.length > 0 ? (
            <ClassDirectory
              classes={workspace.classes}
              onEdit={workspace.handleOpenEdit}
              onArchive={workspace.handleOpenArchive}
            />
          ) : null}
        </div>
      </div>

      {workspace.classFormTarget ? (
        <ClassFormDialog
          key={workspace.classFormTarget === 'new' ? 'new' : workspace.classFormTarget.id}
          isOpen
          classRecord={workspace.classFormTarget === 'new' ? undefined : workspace.classFormTarget}
          onClose={workspace.handleCloseForm}
          onSaved={workspace.handleClassSaved}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {workspace.archiveTarget ? (
        <ArchiveClassDialog
          key={workspace.archiveTarget.id}
          classRecord={workspace.archiveTarget}
          onClose={workspace.handleCloseArchive}
          onArchived={workspace.handleClassArchived}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
