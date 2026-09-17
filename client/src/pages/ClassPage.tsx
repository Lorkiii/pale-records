// Composes active and archived Class workspaces with password-confirmed deletion.
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Header } from '../components/ui/Header';
import { Notice } from '../components/ui/Notice';
import { Tabs } from '../components/ui/Tabs';
import { deleteArchivedClasses, fetchArchivedClasses } from '../features/archive/archive-api';
import { DeleteArchivedDialog } from '../features/archive/DeleteArchivedDialog';
import { useArchivedDirectory } from '../features/archive/useArchivedDirectory';
import { ArchiveClassDialog } from '../features/classes/components/ArchiveClassDialog';
import { ArchivedClassDirectory } from '../features/classes/components/ArchivedClassDirectory';
import { ClassDirectory } from '../features/classes/components/ClassDirectory';
import { ClassFormDialog } from '../features/classes/components/ClassFormDialog';
import { useClassWorkspace } from '../features/classes/useClassWorkspace';
import { useSystemPreferences } from '../features/settings/system-preferences-store';

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
  const [activeTab, setActiveTab] = useState('active');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const workspace = useClassWorkspace(onSessionExpired);
  const archived = useArchivedDirectory(
    activeTab === 'archived', fetchArchivedClasses, onSessionExpired,
  );
  const { preferences } = useSystemPreferences();
  const selectedRecords = archived.records
    .filter((record) => archived.selectedIds.includes(record.id))
    .map((record) => ({ id: record.id, label: record.subjectName }));

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
        <div className="mx-auto max-w-[1440px] px-5 py-5 sm:px-8 sm:py-6 xl:px-12 xl:py-8">
          <Tabs
            ariaLabel="Class directory views"
            className="mb-6"
            tabs={[
              { id: 'active', tabId: 'class-active-tab', panelId: 'class-active-panel', label: 'Active' },
              { id: 'archived', tabId: 'class-archived-tab', panelId: 'class-archived-panel', label: 'Archived' },
            ]}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId);
              archived.selectPage(false);
              if (tabId === 'archived') archived.refresh();
            }}
          />
          {activeTab === 'active' ? (
          <div id="class-active-panel" role="tabpanel" aria-labelledby="class-active-tab">
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
              dateFormat={preferences?.dateFormat}
              timeFormat={preferences?.timeFormat}
              tableDensity={preferences?.tableDensity}
              onEdit={workspace.handleOpenEdit}
              onArchive={workspace.handleOpenArchive}
            />
          ) : null}
          </div>
          ) : (
          <div id="class-archived-panel" role="tabpanel" aria-labelledby="class-archived-tab">
            {archived.loadStatus === 'idle' || archived.loadStatus === 'loading' ? (
              <p role="status" className="border border-ink bg-paper-light p-6 text-sm text-ink-secondary">
                Loading archived classes…
              </p>
            ) : null}
            {archived.loadStatus === 'error' ? (
              <Notice variant="error" title="Class archive unavailable">
                <p>{archived.loadError}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={archived.refresh}>Try again</Button>
              </Notice>
            ) : null}
            {archived.loadStatus === 'ready' ? (
              <ArchivedClassDirectory
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

      {workspace.classFormTarget ? (
        <ClassFormDialog
          key={workspace.classFormTarget === 'new' ? 'new' : workspace.classFormTarget.id}
          isOpen
          classRecord={workspace.classFormTarget === 'new' ? undefined : workspace.classFormTarget}
          newClassDefaults={workspace.classFormTarget === 'new'
            ? {
                schoolYear: preferences?.defaultSchoolYear ?? undefined,
                semester: preferences?.defaultSemester ?? undefined,
              }
            : undefined}
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
      {isDeleteOpen && selectedRecords.length > 0 ? (
        <DeleteArchivedDialog
          resourceLabel="class"
          selectedRecords={selectedRecords}
          onConfirm={deleteArchivedClasses}
          onClose={() => {
            setIsDeleteOpen(false);
            window.requestAnimationFrame(() => document.getElementById('class-archive-delete-trigger')?.focus());
          }}
          onDeleted={() => {
            setIsDeleteOpen(false);
            archived.onDeleted();
            window.requestAnimationFrame(() => document.getElementById('class-archived-tab')?.focus());
          }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
