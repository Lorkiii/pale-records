// Composes the Activity workspace from Recitation feature state and presentation components.
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Header } from '../components/ui/Header';
import { Notice } from '../components/ui/Notice';
import PageLoad from '../components/ui/PageLoad';
import { RecitationRegister } from '../features/activity/recitation/components/RecitationRegister';
import {
  RecitationToolbar,
  type RecitationToolbarFeedback,
} from '../features/activity/recitation/components/RecitationToolbar';
import { useRecitationWorkspace } from '../features/activity/recitation/useRecitationWorkspace';

interface ActivityPageProps {
  onSessionExpired: () => void;
}

// Provides the Recitation symbol used by honest Activity empty states.
function RecitationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h3" />
      <path d="m14.5 15 1.5 1.5 3-3" />
    </svg>
  );
}

// Renders Activity states while delegating Recitation workflow behavior to its hook.
export function ActivityPage({ onSessionExpired }: ActivityPageProps) {
  const navigate = useNavigate();
  const recitation = useRecitationWorkspace(onSessionExpired);
  const toolbarFeedback: RecitationToolbarFeedback | null = recitation.feedback
    ? {
        variant: recitation.feedback.variant,
        title: recitation.feedback.title,
        content: recitation.feedback.messages.length === 1 ? (
          recitation.feedback.messages[0]
        ) : (
          <ul className="list-disc space-y-1 pl-4">
            {recitation.feedback.messages.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ul>
        ),
      }
    : null;

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <Header
        workspacePath="Workspace"
        workspaceTitle="Activity"
        workspaceDescription="Record class Recitation marks by date with deliberate roster editing and saving."
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {recitation.liveMessage}
      </p>

      <div className="archival-grid min-h-[calc(100vh-185px)] min-w-0">
        <div className="mx-auto min-w-0 max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {recitation.loadStatus === 'loading' ? (
            <PageLoad message="Loading Activity workspace…" />
          ) : null}

          {recitation.loadStatus === 'error' ? (
            <Notice variant="error" title="Activity workspace unavailable">
              <div className="space-y-4">
                <p>{recitation.loadError}</p>
                <Button size="sm" variant="secondary" onClick={recitation.handleRetryLoad}>
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {recitation.loadStatus === 'ready' && recitation.classes.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<RecitationIcon />}
                title="No classes available"
                description="Add an active class before opening a Recitation register."
                action={
                  <Button variant="secondary" onClick={() => navigate('/dashboard/classes')}>
                    Go to classes
                  </Button>
                }
                className="min-h-72"
              />
            </div>
          ) : null}

          {recitation.loadStatus === 'ready' && recitation.classes.length > 0 ? (
            <div className="min-w-0 space-y-8">
              <RecitationToolbar
                classes={recitation.classes}
                selectedClassId={recitation.selectedClassId}
                monthInput={recitation.monthInput}
                dateInput={recitation.dateInput}
                queuedDates={recitation.queuedDates}
                pendingDateCount={recitation.pendingDateCount}
                selectedDate={recitation.selectedDate}
                selectedSession={recitation.selectedSessionDraft ?? null}
                isEditing={recitation.isEditing}
                hasUnsavedChanges={recitation.hasUnsavedChanges}
                isBusy={recitation.isBusy}
                isCreating={recitation.isCreating}
                isSaving={recitation.isSaving}
                canUndo={recitation.canUndo}
                canQueueDate={recitation.canQueueDate}
                canAddDates={recitation.canAddDates}
                dateHint={recitation.dateHint}
                markCounts={recitation.markCounts}
                feedback={toolbarFeedback}
                onClassChange={recitation.handleClassChange}
                onMonthInputChange={recitation.handleMonthChange}
                onDateInputChange={recitation.handleDateInputChange}
                onQueueDate={recitation.handleQueueDate}
                onRemoveQueuedDate={recitation.handleRemoveQueuedDate}
                onClearQueuedDates={recitation.handleClearQueuedDates}
                onAddDates={recitation.handleAddDates}
                onEdit={recitation.handleEdit}
                onUndo={recitation.handleUndo}
                onCancel={recitation.handleCancel}
                onSave={recitation.handleSave}
              />

              {!recitation.selectedClass ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<RecitationIcon />}
                    title="No class selected"
                    description="Select an active class to load its Recitation dates for the calendar month."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {recitation.selectedClass && recitation.sessionLoadStatus === 'loading' ? (
                <div className="border border-ink bg-paper-light px-5 py-10 text-center">
                  <p
                    role="status"
                    className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted"
                  >
                    Loading Recitation month…
                  </p>
                </div>
              ) : null}

              {recitation.selectedClass && recitation.sessionLoadStatus === 'error' ? (
                <Notice variant="error" title="Recitation month unavailable">
                  <div className="space-y-4">
                    <p>{recitation.sessionLoadError}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={recitation.handleRetrySessionLoad}
                    >
                      Try again
                    </Button>
                  </div>
                </Notice>
              ) : null}

              {recitation.selectedClass &&
              recitation.sessionLoadStatus === 'ready' &&
              recitation.sessionDrafts.length === 0 ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<RecitationIcon />}
                    title="No Recitation dates this month"
                    description="No Recitation sessions have been created for this class month. Manual Add date remains available above."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {recitation.selectedClass &&
              recitation.sessionLoadStatus === 'ready' &&
              recitation.sessionDrafts.length > 0 &&
              !recitation.selectedSessionId ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<RecitationIcon />}
                    title="No Recitation date selected"
                    description="Select a date column to review its roster."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {recitation.selectedClass &&
              recitation.sessionLoadStatus === 'ready' &&
              recitation.selectedSessionId &&
              recitation.selectedRoster.length === 0 ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<RecitationIcon />}
                    title={recitation.selectedSessionDraft?.isRosterInitialized
                      ? 'Saved Recitation roster is empty'
                      : 'No students in this draft roster'}
                    description={recitation.selectedSessionDraft?.isRosterInitialized
                      ? 'This date has a genuine empty historical roster. It remains loadable and saveable.'
                      : 'This date has no currently enrolled students. Viewing it has not created Recitation records.'}
                    action={!recitation.selectedSessionDraft?.isRosterInitialized ? (
                      <Button
                        variant="secondary"
                        onClick={() => navigate('/dashboard/students')}
                      >
                        Go to students
                      </Button>
                    ) : undefined}
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {recitation.selectedClass &&
              recitation.sessionLoadStatus === 'ready' &&
              recitation.selectedSessionId &&
              recitation.sessionDrafts.length > 0 ? (
                <RecitationRegister
                  roster={recitation.selectedRoster}
                  sessionDrafts={recitation.sessionDrafts}
                  selectedSessionId={recitation.selectedSessionId}
                  isEditing={recitation.isEditing}
                  isBusy={recitation.isBusy}
                  onSelectSession={recitation.handleSelectSession}
                  onCycleMark={recitation.handleCycleMark}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
