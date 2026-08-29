// Composes the Agenda workspace, confirmed CRUD dialogs, and explicit legacy import flow.
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Header } from '../components/ui/Header';
import { Notice } from '../components/ui/Notice';
import PageLoad from '../components/ui/PageLoad';
import {
  getAuthenticatedUserDisplayName,
  type AuthenticatedUser,
} from '../features/auth/auth-api';
import type { AgendaEvent } from '../features/agenda/agenda-types';
import { AgendaCalendarGrid } from '../features/agenda/components/AgendaCalendarGrid';
import { AgendaDayDocket } from '../features/agenda/components/AgendaDayDocket';
import { AgendaEventDialog } from '../features/agenda/components/AgendaEventDialog';
import { AgendaLegacyImportDialog } from '../features/agenda/components/AgendaLegacyImportDialog';
import { AgendaToolbar } from '../features/agenda/components/AgendaToolbar';
import { DeleteAgendaEventDialog } from '../features/agenda/components/DeleteAgendaEventDialog';
import { useAgendaWorkspace } from '../features/agenda/useAgendaWorkspace';
import { useAgendaLegacyImport } from '../features/agenda/useAgendaLegacyImport';

interface AgendaPageProps {
  currentUser: AuthenticatedUser;
  onSessionExpired: () => void;
}

export function AgendaPage({ currentUser, onSessionExpired }: AgendaPageProps) {
  const agenda = useAgendaWorkspace(onSessionExpired);
  const legacyImport = useAgendaLegacyImport({
    isAgendaReady: agenda.eventLoadStatus === 'ready',
    onImportComplete: agenda.retryEventLoad,
    onSessionExpired,
  });
  const accountName = getAuthenticatedUserDisplayName(currentUser);

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<AgendaEvent | null>(null);
  const [dialogDateKey, setDialogDateKey] = useState(agenda.selectedDateKey);

  const handleOpenCreate = (dateKey?: string) => {
    if (!agenda.canManageEvents) return;
    setEditingEvent(null);
    setDialogDateKey(dateKey || agenda.selectedDateKey);
    setIsEventDialogOpen(true);
  };

  const handleOpenEdit = (event: AgendaEvent) => {
    setEditingEvent(event);
    setDialogDateKey(event.eventDate);
    setIsEventDialogOpen(true);
  };

  const handleOpenDelete = (event: AgendaEvent) => {
    setDeletingEvent(event);
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <Header
        workspacePath="Workspace"
        workspaceTitle="Agenda"
        workspaceDescription="Plan academic milestones, exams, deadlines, and view class sessions across dates."
        actionButton={
          <Button
            variant="primary"
            aria-haspopup="dialog"
            disabled={!agenda.canManageEvents}
            onClick={() => handleOpenCreate(agenda.selectedDateKey)}
            leftIcon={<span className="font-mono text-base font-normal leading-none">+</span>}
          >
            Add Event
          </Button>
        }
      />

      <div className="archival-grid min-h-[calc(100vh-185px)]">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8 xl:px-12">
          {/* Feedback notice */}
          {agenda.feedback && (
            <div className="mb-5">
              <Notice
                variant={agenda.feedback.variant}
                title={agenda.feedback.title}
                onDismiss={agenda.dismissFeedback}
              >
                {agenda.feedback.message}
              </Notice>
            </div>
          )}

          {legacyImport.pageNotice ? (
            <div className="mb-5">
              <Notice
                variant={legacyImport.pageNotice.variant}
                title={legacyImport.pageNotice.title}
                onDismiss={legacyImport.dismissPageNotice}
              >
                {legacyImport.pageNotice.message}
              </Notice>
            </div>
          ) : null}

          {legacyImport.legacyStorageWarning ? (
            <div className="mb-5">
              <Notice variant="warning" title="Legacy Agenda data not imported">
                {legacyImport.legacyStorageWarning}
              </Notice>
            </div>
          ) : null}

          {agenda.eventLoadStatus === 'loading' ? (
            <PageLoad message="Loading Agenda events…" />
          ) : null}

          {agenda.eventLoadStatus === 'error' ? (
            <Notice variant="error" title="Agenda events unavailable">
              <div className="space-y-4">
                <p>{agenda.eventLoadError}</p>
                <Button size="sm" variant="secondary" onClick={agenda.retryEventLoad}>
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {agenda.eventLoadStatus === 'ready' ? (
            <div className="space-y-5">
              {agenda.classLoadStatus === 'error' ? (
                <Notice variant="warning" title="Class schedules temporarily unavailable">
                  <div className="space-y-4">
                    <p>
                      {agenda.classLoadError} Custom Agenda events remain available, but recurring
                      Class schedules and Class association choices are hidden until Classes reload.
                    </p>
                    <Button size="sm" variant="secondary" onClick={agenda.retryClassLoad}>
                      Try Classes again
                    </Button>
                  </div>
                </Notice>
              ) : null}

              {/* Main Agenda Container */}
              <div className="flex flex-col border border-ink bg-paper-light shadow-none">
                <AgendaToolbar
                  viewYear={agenda.viewYear}
                  viewMonth={agenda.viewMonth}
                  classes={agenda.classes}
                  selectedClassId={agenda.selectedClassId}
                  selectedTypeFilter={agenda.selectedTypeFilter}
                  onClassFilterChange={agenda.setSelectedClassId}
                  onTypeFilterChange={agenda.setSelectedTypeFilter}
                  onPrevMonth={agenda.goToPrevMonth}
                  onNextMonth={agenda.goToNextMonth}
                  onToday={agenda.goToToday}
                  onAddEventClick={() => handleOpenCreate(agenda.selectedDateKey)}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12">
                  <div className="border-b border-ink p-4 sm:p-5 lg:col-span-7 lg:border-r lg:border-b-0 xl:col-span-8">
                    <AgendaCalendarGrid
                      cells={agenda.calendarCells}
                      onSelectDate={agenda.selectDate}
                    />
                  </div>

                  <div className="bg-paper-light p-4 sm:p-5 lg:col-span-5 xl:col-span-4">
                    <AgendaDayDocket
                      selectedDateKey={agenda.selectedDateKey}
                      events={agenda.selectedDateEvents}
                      sessions={agenda.selectedDateSessions}
                      classes={agenda.classes}
                      onAddEvent={handleOpenCreate}
                      onEditEvent={handleOpenEdit}
                      onDeleteEvent={handleOpenDelete}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create & Edit Modal Dialog */}
      <AgendaEventDialog
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false);
          setEditingEvent(null);
        }}
        classes={agenda.classes}
        isClassSelectionAvailable={agenda.classLoadStatus === 'ready'}
        initialDateKey={dialogDateKey}
        editingEvent={editingEvent}
        onSave={async (data) => {
          if (editingEvent) {
            await agenda.updateEvent(editingEvent.id, data);
          } else {
            await agenda.createEvent(data);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteAgendaEventDialog
        key={deletingEvent?.id ?? 'no-event'}
        isOpen={Boolean(deletingEvent)}
        onClose={() => setDeletingEvent(null)}
        event={deletingEvent}
        onConfirm={async () => {
          if (deletingEvent) {
            await agenda.deleteEvent(deletingEvent.id);
          }
        }}
      />

      <AgendaLegacyImportDialog
        isOpen={legacyImport.isDialogOpen}
        eventCount={legacyImport.eventCount}
        accountName={accountName}
        accountEmail={currentUser.email}
        isImporting={legacyImport.isImporting}
        currentIndex={legacyImport.currentIndex}
        importedCount={legacyImport.importedCount}
        alreadyImportedCount={legacyImport.alreadyImportedCount}
        removedClassAssociationCount={legacyImport.removedClassAssociationCount}
        errorMessage={legacyImport.currentRequestError}
        onClose={legacyImport.dismissImport}
        onImport={legacyImport.importEvents}
      />
    </div>
  );
}
