// Composes active and archived Student workspaces with password-confirmed deletion.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Header } from '../components/ui/Header';
import { Notice } from '../components/ui/Notice';
import { Tabs } from '../components/ui/Tabs';
import { deleteArchivedStudents, fetchArchivedStudents } from '../features/archive/archive-api';
import { DeleteArchivedDialog } from '../features/archive/DeleteArchivedDialog';
import { useArchivedDirectory } from '../features/archive/useArchivedDirectory';
import { ArchiveStudentDialog } from '../features/students/components/ArchiveStudentDialog';
import { ArchivedStudentDirectory } from '../features/students/components/ArchivedStudentDirectory';
import { StudentDirectory } from '../features/students/components/StudentDirectory';
import { StudentDetailsDialog } from '../features/students/components/StudentDetailsDialog';
import { StudentFormDialog } from '../features/students/components/StudentFormDialog';
import { useStudentWorkspace } from '../features/students/useStudentWorkspace';
import { useSystemPreferences } from '../features/settings/system-preferences-store';

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
  const [activeTab, setActiveTab] = useState('active');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const workspace = useStudentWorkspace(onSessionExpired);
  const archived = useArchivedDirectory(
    activeTab === 'archived', fetchArchivedStudents, onSessionExpired,
  );
  const { preferences } = useSystemPreferences();
  const pageRef = useRef<HTMLDivElement>(null);
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedRecords = archived.records
    .filter((record) => archived.selectedIds.includes(record.id))
    .map((record) => ({ id: record.id, label: `${record.firstName} ${record.lastName}` }));

  const restoreDirectoryFocus = () => {
    window.requestAnimationFrame(() => {
      const target = viewTriggerRef.current?.isConnected
        ? viewTriggerRef.current
        : document.getElementById('student-directory-heading') ?? pageRef.current;
      target?.focus();
      viewTriggerRef.current = null;
    });
  };

  return (
    <div ref={pageRef} tabIndex={-1} className="min-h-screen">
      <Header
        workspacePath="Workspace"
        workspaceTitle="Students"
        workspaceDescription="Add each student once, assign every class they attend, and review saved identity details."
        actionButton={
          <Button onClick={(event) => {
            viewTriggerRef.current = event.currentTarget;
            workspace.handleOpenForm();
          }} disabled={!workspace.canAddStudent}>
            Add student
          </Button>
        }
      />

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          <Tabs
            ariaLabel="Student directory views"
            className="mb-6"
            tabs={[
              { id: 'active', tabId: 'student-active-tab', panelId: 'student-active-panel', label: 'Active' },
              { id: 'archived', tabId: 'student-archived-tab', panelId: 'student-archived-panel', label: 'Archived' },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId);
              archived.selectPage(false);
              if (tabId === 'archived') archived.refresh();
            }}
          />
          {activeTab === 'active' ? (
          <div id="student-active-panel" role="tabpanel" aria-labelledby="student-active-tab">
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
                action={<Button onClick={(event) => {
                  viewTriggerRef.current = event.currentTarget;
                  workspace.handleOpenForm();
                }}>Add student</Button>}
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
                tableDensity={preferences?.tableDensity}
                onView={(student, trigger) => {
                  viewTriggerRef.current = trigger;
                  workspace.handleOpenDetails(student);
                }}
              />
            </div>
          ) : null}
          </div>
          ) : (
          <div id="student-archived-panel" role="tabpanel" aria-labelledby="student-archived-tab">
            {archived.loadStatus === 'idle' || archived.loadStatus === 'loading' ? (
              <p role="status" className="border border-ink bg-paper-light p-6 text-sm text-ink-secondary">
                Loading archived students…
              </p>
            ) : null}
            {archived.loadStatus === 'error' ? (
              <Notice variant="error" title="Student archive unavailable">
                <p>{archived.loadError}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={archived.refresh}>Try again</Button>
              </Notice>
            ) : null}
            {archived.loadStatus === 'ready' ? (
              <ArchivedStudentDirectory
                records={archived.records}
                selectedIds={archived.selectedIds}
                eligibleIds={archived.eligibleIds}
                page={archived.page}
                hasMore={archived.hasMore}
                dateFormat={preferences?.dateFormat}
                onToggle={archived.toggleSelected}
                onSelectPage={archived.selectPage}
                onDelete={() => setIsDeleteOpen(true)}
                onPageChange={archived.changePage}
                onRefresh={archived.refresh}
              />
            ) : null}
          </div>
          )}
        </div>
      </div>

      {workspace.detailTarget ? (
        <StudentDetailsDialog
          student={workspace.detailTarget}
          canEdit={workspace.classes.length > 0}
          onClose={() => {
            workspace.handleCloseDetails();
            restoreDirectoryFocus();
          }}
          onEdit={workspace.handleOpenEdit}
          onArchive={workspace.handleOpenArchive}
        />
      ) : null}

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
          onClose={() => {
            workspace.handleCloseForm();
            restoreDirectoryFocus();
          }}
          onSaved={(student) => {
            workspace.handleStudentSaved(student);
            restoreDirectoryFocus();
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {workspace.archiveTarget ? (
        <ArchiveStudentDialog
          key={workspace.archiveTarget.id}
          studentRecord={workspace.archiveTarget}
          onClose={() => {
            workspace.handleCloseArchive();
            restoreDirectoryFocus();
          }}
          onArchived={(studentId) => {
            workspace.handleStudentArchived(studentId);
            restoreDirectoryFocus();
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
      {isDeleteOpen && selectedRecords.length > 0 ? (
        <DeleteArchivedDialog
          resourceLabel="student"
          selectedRecords={selectedRecords}
          onConfirm={deleteArchivedStudents}
          onClose={() => {
            setIsDeleteOpen(false);
            window.requestAnimationFrame(() => document.getElementById('student-archive-delete-trigger')?.focus());
          }}
          onDeleted={() => {
            setIsDeleteOpen(false);
            archived.onDeleted();
            window.requestAnimationFrame(() => document.getElementById('student-archived-tab')?.focus());
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
