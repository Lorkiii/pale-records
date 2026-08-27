// Composes the Students workspace from feature-owned state, actions, and dialogs.
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import { ArchiveStudentDialog } from '../features/students/components/ArchiveStudentDialog';
import { StudentDirectory } from '../features/students/components/StudentDirectory';
import { StudentFormDialog } from '../features/students/components/StudentFormDialog';
import { useStudentWorkspace } from '../features/students/useStudentWorkspace';

interface StudentPageProps {
  onSessionExpired: () => void;
}

// Provides the student symbol used by student directory empty states.
function StudentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.7-4.5 3.4-7 8-7s7.3 2.5 8 7" />
    </svg>
  );
}

// Renders Students workspace states and delegates workflow behavior to its feature hook.
export function StudentPage({ onSessionExpired }: StudentPageProps) {
  const navigate = useNavigate();
  const workspace = useStudentWorkspace(onSessionExpired);

  return (
    <div className="min-h-screen">
      <header className="border-b border-paper-border bg-paper-light">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 px-5 py-8 sm:px-8 sm:py-10 md:flex-row md:items-end xl:px-12">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Workspace / Students
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
              Students
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
              Add each student once, assign every class they attend, and review saved identity details.
            </p>
          </div>
          <Button onClick={workspace.handleOpenForm} disabled={!workspace.canAddStudent}>
            Add student
          </Button>
        </div>
      </header>

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {workspace.loadStatus === 'loading' ? (
            <div className="border border-ink bg-paper-light px-5 py-10 text-center">
              <p role="status" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Loading student workspace…
              </p>
            </div>
          ) : null}

          {workspace.loadStatus === 'error' ? (
            <Notice variant="error" title="Student workspace unavailable">
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

          {workspace.loadStatus === 'ready' &&
          workspace.classes.length === 0 &&
          workspace.students.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<StudentIcon />}
                title="No classes available"
                description="Add a class before adding students, because every student needs at least one class."
                action={
                  <Button variant="secondary" onClick={() => navigate('/dashboard/classes')}>
                    Go to classes
                  </Button>
                }
                className="min-h-72"
              />
            </div>
          ) : null}

          {workspace.loadStatus === 'ready' &&
          workspace.classes.length > 0 &&
          workspace.students.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<StudentIcon />}
                title="No students added"
                description="Add the first student and select every class they attend."
                action={<Button onClick={workspace.handleOpenForm}>Add student</Button>}
                className="min-h-72"
              />
            </div>
          ) : null}

          {workspace.loadStatus === 'ready' && workspace.students.length > 0 ? (
            <div className="space-y-8">
              {workspace.classes.length === 0 ? (
                <Notice variant="warning" title="No active classes">
                  <div className="space-y-4">
                    <p>Saved students remain available, but students cannot be added or edited until an active class exists.</p>
                    <Button size="sm" variant="secondary" onClick={() => navigate('/dashboard/classes')}>
                      Go to classes
                    </Button>
                  </div>
                </Notice>
              ) : null}
              <StudentDirectory
                students={workspace.students}
                canEdit={workspace.classes.length > 0}
                onEdit={workspace.handleOpenEdit}
                onArchive={workspace.handleOpenArchive}
              />
            </div>
          ) : null}
        </div>
      </div>

      {workspace.studentFormTarget ? (
        <StudentFormDialog
          key={workspace.studentFormTarget === 'new'
            ? 'new'
            : workspace.studentFormTarget.id}
          isOpen
          classes={workspace.classes}
          studentRecord={workspace.studentFormTarget === 'new'
            ? undefined
            : workspace.studentFormTarget}
          onClose={workspace.handleCloseForm}
          onSaved={workspace.handleStudentSaved}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {workspace.archiveTarget ? (
        <ArchiveStudentDialog
          key={workspace.archiveTarget.id}
          studentRecord={workspace.archiveTarget}
          onClose={workspace.handleCloseArchive}
          onArchived={workspace.handleStudentArchived}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
