// Composes the Agenda workspace with monthly matrix, daily docket, and event creation dialogs.
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Header } from '../components/ui/Header';
import { Notice } from '../components/ui/Notice';
import type { AgendaEvent } from '../features/agenda/agenda-types';
import { AgendaCalendarGrid } from '../features/agenda/components/AgendaCalendarGrid';
import { AgendaDayDocket } from '../features/agenda/components/AgendaDayDocket';
import { AgendaEventDialog } from '../features/agenda/components/AgendaEventDialog';
import { AgendaToolbar } from '../features/agenda/components/AgendaToolbar';
import { DeleteAgendaEventDialog } from '../features/agenda/components/DeleteAgendaEventDialog';
import { useAgendaWorkspace } from '../features/agenda/useAgendaWorkspace';

interface AgendaPageProps {
  onSessionExpired?: () => void;
}

export function AgendaPage({ onSessionExpired }: AgendaPageProps) {
  const agenda = useAgendaWorkspace(onSessionExpired);

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<AgendaEvent | null>(null);
  const [dialogDateKey, setDialogDateKey] = useState(agenda.selectedDateKey);

  const handleOpenCreate = (dateKey?: string) => {
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

          {/* Main Agenda Container */}
          <div className="flex flex-col border border-ink bg-paper-light shadow-none">
            {/* Toolbar */}
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

            {/* Split Screen Layout (Option A): Calendar Grid (Left) + Day Docket (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left Calendar Grid (7 cols) */}
              <div className="p-4 sm:p-5 lg:col-span-7 xl:col-span-8 border-b lg:border-b-0 lg:border-r border-ink">
                <AgendaCalendarGrid
                  cells={agenda.calendarCells}
                  onSelectDate={agenda.selectDate}
                />
              </div>

              {/* Right Day Docket (5 cols) */}
              <div className="p-4 sm:p-5 lg:col-span-5 xl:col-span-4 bg-paper-light">
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
      </div>

      {/* Create & Edit Modal Dialog */}
      <AgendaEventDialog
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false);
          setEditingEvent(null);
        }}
        classes={agenda.classes}
        initialDateKey={dialogDateKey}
        editingEvent={editingEvent}
        onSave={(data) => {
          if (editingEvent) {
            agenda.updateEvent(editingEvent.id, data);
          } else {
            agenda.createEvent(data);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteAgendaEventDialog
        isOpen={Boolean(deletingEvent)}
        onClose={() => setDeletingEvent(null)}
        event={deletingEvent}
        onConfirm={() => {
          if (deletingEvent) {
            agenda.deleteEvent(deletingEvent.id);
          }
        }}
      />
    </div>
  );
}
