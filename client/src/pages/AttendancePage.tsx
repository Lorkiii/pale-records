// Composes active classes with persisted Attendance sessions and deliberate local draft editing.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import {
  AttendanceApiError,
  createAttendanceSession,
  listAttendanceSessions,
  saveAttendanceSessionRecords,
} from '../features/attendance/attendance-api';
import {
  cloneAttendanceRecords,
  countAttendanceStatuses,
  createAttendanceSessionDraft,
  cycleAttendanceStatus,
  formatAttendanceDateLong,
  getAttendanceSessionRoster,
  isAttendanceDateValue,
  isAttendanceSessionDirty,
  markUnmarkedAsPresent,
  sortAttendanceSessionDrafts,
  updateAttendanceRecord,
  validateAttendanceSessionDraft,
} from '../features/attendance/attendance-draft';
import { AttendanceDetailsDialog } from '../features/attendance/components/AttendanceDetailsDialog';
import { AttendanceRegister } from '../features/attendance/components/AttendanceRegister';
import { DeleteAttendanceSessionDialog } from '../features/attendance/components/DeleteAttendanceSessionDialog';
import {
  AttendanceToolbar,
  type AttendanceToolbarFeedback,
} from '../features/attendance/components/AttendanceToolbar';
import type {
  AttendanceSessionDraft,
  AttendanceStudentRecord,
  WorkingAttendanceRecord,
  WorkingAttendanceRecordsByStudentId,
} from '../features/attendance/attendance-types';
import { ClassApiError, fetchClasses } from '../features/classes/classes-api';
import type { ClassRecord } from '../features/classes/class-types';

interface AttendancePageProps {
  onSessionExpired: () => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';
type SessionLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type AttendanceDraftsByClassId = Record<string, AttendanceSessionDraft[]>;

interface FeedbackState {
  variant: AttendanceToolbarFeedback['variant'];
  title: string;
  messages: string[];
}

// Replaces one session in its class collection while preserving chronological columns.
function replaceClassSessionDraft(
  draftsByClassId: AttendanceDraftsByClassId,
  classId: string,
  sessionDraft: AttendanceSessionDraft,
) {
  const currentSessions = draftsByClassId[classId] ?? [];
  const existingIndex = currentSessions.findIndex(
    (currentSession) => currentSession.id === sessionDraft.id,
  );
  const nextSessions = existingIndex === -1
    ? [...currentSessions, sessionDraft]
    : currentSessions.map((currentSession) =>
      currentSession.id === sessionDraft.id ? sessionDraft : currentSession,
    );

  return {
    ...draftsByClassId,
    [classId]: sortAttendanceSessionDrafts(nextSessions),
  };
}

// Collects safe server field and form messages without duplicating the primary error.
function getAttendanceApiMessages(error: AttendanceApiError) {
  const messages = [
    error.message,
    ...error.formErrors,
    ...Object.values(error.fieldErrors).flat(),
  ];
  return [...new Set(messages)];
}

// Provides the Attendance symbol used by honest empty workspace states.
function AttendanceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" />
      <path d="M8 3v4M16 3v4M4 9h16M8 15l2 2 5-5" />
    </svg>
  );
}

// Coordinates persisted session loading with one selected session's local working snapshots.
export function AttendancePage({ onSessionExpired }: AttendancePageProps) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [sessionLoadStatus, setSessionLoadStatus] = useState<SessionLoadStatus>('idle');
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [sessionLoadAttempt, setSessionLoadAttempt] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftsByClassId, setDraftsByClassId] = useState<AttendanceDraftsByClassId>({});
  const [undoRecords, setUndoRecords] = useState<WorkingAttendanceRecordsByStudentId | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<AttendanceStudentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceSessionDraft | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emptyRosterClassId, setEmptyRosterClassId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchClasses(controller.signal)
      .then((classRecords) => {
        setClasses(classRecords);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (error instanceof ClassApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to load the attendance workspace.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  useEffect(() => {
    if (!selectedClassId) {
      return undefined;
    }

    const controller = new AbortController();

    listAttendanceSessions(selectedClassId, controller.signal)
      .then((sessions) => {
        const sessionDrafts = sortAttendanceSessionDrafts(
          sessions.map(createAttendanceSessionDraft),
        );
        setDraftsByClassId((currentDrafts) => ({
          ...currentDrafts,
          [selectedClassId]: sessionDrafts,
        }));
        setSelectedSessionId(sessions[0]?.id ?? null);
        if (sessions.length > 0) {
          setEmptyRosterClassId(null);
        }
        setEditingSessionId(null);
        setUndoRecords(null);
        setDetailsTarget(null);
        setDeleteTarget(null);
        setSessionLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (error instanceof AttendanceApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        setSessionLoadError(error instanceof Error
          ? error.message
          : 'Unable to load saved attendance sessions.');
        setSessionLoadStatus('error');
      });

    return () => controller.abort();
  }, [onSessionExpired, selectedClassId, sessionLoadAttempt]);

  const selectedClass = useMemo(
    () => classes.find((classRecord) => classRecord.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const selectedClassSessions = useMemo(
    () => sortAttendanceSessionDrafts(draftsByClassId[selectedClassId] ?? []),
    [draftsByClassId, selectedClassId],
  );
  const selectedSessionDraft = selectedClassSessions.find(
    (sessionDraft) => sessionDraft.id === selectedSessionId,
  );
  const selectedRoster = useMemo(
    () => getAttendanceSessionRoster(selectedSessionDraft),
    [selectedSessionDraft],
  );
  const selectedDate = selectedSessionDraft?.sessionDate ?? null;
  const detailsRecord = detailsTarget && selectedSessionDraft
    ? selectedSessionDraft.records[detailsTarget.id]
    : undefined;
  const isEditing = selectedSessionId !== null && editingSessionId === selectedSessionId;
  const hasUnsavedChanges = isEditing && isAttendanceSessionDirty(selectedSessionDraft);
  const statusCounts = countAttendanceStatuses(selectedSessionDraft);
  const isBusy = sessionLoadStatus === 'loading' || isCreating || isSaving;
  const canAddDate = Boolean(
    selectedClass &&
    isAttendanceDateValue(dateInput) &&
    !hasUnsavedChanges &&
    !isBusy,
  );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    // Protects the only unsaved local working copy on refresh or close.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const dateHint = !selectedClass
    ? 'Select a class before adding an attendance date.'
    : sessionLoadStatus === 'loading'
      ? 'Loading saved attendance dates…'
      : 'One persisted session is allowed per class and calendar date.';

  const toolbarFeedback: AttendanceToolbarFeedback | null = feedback
    ? {
      variant: feedback.variant,
      title: feedback.title,
      content: feedback.messages.length === 1 ? feedback.messages[0] : (
        <ul className="list-disc space-y-1 pl-4">
          {feedback.messages.map((message, index) => (
            <li key={`${message}-${index}`}>{message}</li>
          ))}
        </ul>
      ),
    }
    : null;

  // Replaces only the selected session's local working and server snapshots.
  const setSelectedDraft = (sessionDraft: AttendanceSessionDraft) => {
    setDraftsByClassId((currentDrafts) =>
      replaceClassSessionDraft(currentDrafts, selectedClassId, sessionDraft),
    );
  };

  // Refuses a class switch while dirty and otherwise starts a fresh persisted-session load.
  const handleClassChange = (classId: string) => {
    if (hasUnsavedChanges) {
      setFeedback({
        variant: 'warning',
        title: 'Unsaved attendance',
        messages: ['Save attendance or cancel changes before switching classes.'],
      });
      return;
    }

    setSelectedClassId(classId);
    setSessionLoadStatus(classId ? 'loading' : 'idle');
    setSessionLoadError('');
    setSelectedSessionId(null);
    setEditingSessionId(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setDeleteTarget(null);
    setEmptyRosterClassId(null);
    setFeedback(null);
  };

  // Creates one server session or reloads and selects a concurrently created duplicate.
  const handleAddDate = async () => {
    if (!selectedClass || !isAttendanceDateValue(dateInput) || isBusy) {
      setFeedback({
        variant: 'error',
        title: 'Attendance date required',
        messages: ['Choose an active class and a valid calendar date.'],
      });
      return;
    }

    const existingSession = selectedClassSessions.find(
      (sessionDraft) => sessionDraft.sessionDate === dateInput,
    );
    if (existingSession) {
      setSelectedSessionId(existingSession.id);
      setEditingSessionId(null);
      setUndoRecords(null);
      setFeedback({
        variant: 'info',
        title: 'Date already saved',
        messages: [`${formatAttendanceDateLong(dateInput)} was selected without creating a duplicate.`],
      });
      return;
    }

    setIsCreating(true);
    setFeedback(null);
    try {
      const session = await createAttendanceSession(selectedClass.id, dateInput);
      const sessionDraft = createAttendanceSessionDraft(session);
      setDraftsByClassId((currentDrafts) =>
        replaceClassSessionDraft(currentDrafts, selectedClass.id, sessionDraft),
      );
      setSelectedSessionId(session.id);
      setEmptyRosterClassId(null);
      setEditingSessionId(session.id);
      setUndoRecords(null);
      setFeedback({
        variant: 'success',
        title: 'Attendance date created',
        messages: ['The date and current enrolled roster were saved. Status edits remain local until Save attendance.'],
      });
      setLiveMessage(`${formatAttendanceDateLong(session.sessionDate)} created and ready to edit.`);
    } catch (error: unknown) {
      if (error instanceof AttendanceApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      if (
        error instanceof AttendanceApiError &&
        error.code === 'ATTENDANCE_SESSION_EXISTS'
      ) {
        try {
          const sessions = await listAttendanceSessions(
            selectedClass.id,
            new AbortController().signal,
          );
          const sessionDrafts = sortAttendanceSessionDrafts(
            sessions.map(createAttendanceSessionDraft),
          );
          const duplicate = sessions.find((session) => session.sessionDate === dateInput);
          setDraftsByClassId((currentDrafts) => ({
            ...currentDrafts,
            [selectedClass.id]: sessionDrafts,
          }));
          setSelectedSessionId(duplicate?.id ?? sessions[0]?.id ?? null);
          setEditingSessionId(null);
          setUndoRecords(null);
          setFeedback({
            variant: 'info',
            title: 'Date already saved',
            messages: [`${formatAttendanceDateLong(dateInput)} was reloaded without creating a duplicate.`],
          });
        } catch (reloadError: unknown) {
          if (reloadError instanceof AttendanceApiError && reloadError.status === 401) {
            onSessionExpired();
            return;
          }

          setFeedback({
            variant: 'error',
            title: 'Attendance reload failed',
            messages: [reloadError instanceof Error
              ? reloadError.message
              : 'The existing attendance date could not be reloaded.'],
          });
        }
        return;
      }

      if (
        error instanceof AttendanceApiError &&
        error.code === 'CLASS_HAS_NO_STUDENTS'
      ) {
        setEmptyRosterClassId(selectedClass.id);
        setFeedback({
          variant: 'warning',
          title: 'No enrolled students',
          messages: ['This class needs an enrolled student before an Attendance session can be created.'],
        });
        return;
      }

      setFeedback({
        variant: 'error',
        title: 'Attendance date not created',
        messages: error instanceof AttendanceApiError
          ? getAttendanceApiMessages(error)
          : [error instanceof Error ? error.message : 'Unable to create the attendance date.'],
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Selects another persisted session without abandoning a dirty working copy.
  const handleSelectSession = (sessionId: string) => {
    if (sessionId === selectedSessionId) {
      return;
    }

    if (hasUnsavedChanges) {
      setFeedback({
        variant: 'warning',
        title: 'Unsaved attendance',
        messages: ['Save attendance or cancel changes before switching dates.'],
      });
      return;
    }

    const nextSession = selectedClassSessions.find((session) => session.id === sessionId);
    setSelectedSessionId(sessionId);
    setEditingSessionId(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setDeleteTarget(null);
    setFeedback(null);
    if (nextSession) {
      setLiveMessage(`${formatAttendanceDateLong(nextSession.sessionDate)} selected in read-only mode.`);
    }
  };

  // Creates a fresh local working copy from the selected server snapshot.
  const handleEdit = () => {
    if (!selectedSessionDraft || !selectedSessionId) {
      return;
    }

    setSelectedDraft({
      ...selectedSessionDraft,
      records: cloneAttendanceRecords(selectedSessionDraft.savedRecords),
    });
    setEditingSessionId(selectedSessionId);
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage(`${formatAttendanceDateLong(selectedSessionDraft.sessionDate)} is now editable.`);
  };

  // Removes the deleted session locally and selects the newest remaining saved date.
  const handleDeletedSession = (sessionId: string) => {
    const remainingSessions = selectedClassSessions.filter(
      (sessionDraft) => sessionDraft.id !== sessionId,
    );

    setDraftsByClassId((currentDrafts) => ({
      ...currentDrafts,
      [selectedClassId]: remainingSessions,
    }));
    setSelectedSessionId(remainingSessions.at(-1)?.id ?? null);
    setEditingSessionId(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setDeleteTarget(null);
    setEmptyRosterClassId(null);
    setFeedback({
      variant: 'success',
      title: 'Attendance date deleted',
      messages: ['The saved date and all attendance records in its roster were deleted.'],
    });
    setLiveMessage('The selected attendance date was deleted.');
  };

  // Applies one PALE cycle step and clears remarks whenever the next status is not Excused.
  const handleCycleStatus = (studentId: string) => {
    if (!selectedSessionDraft || !isEditing) {
      return;
    }

    const currentRecord = selectedSessionDraft.records[studentId];
    if (!currentRecord) {
      return;
    }

    const nextStatus = cycleAttendanceStatus(currentRecord.status);
    setUndoRecords(cloneAttendanceRecords(selectedSessionDraft.records));
    setSelectedDraft(updateAttendanceRecord(selectedSessionDraft, studentId, {
      ...currentRecord,
      status: nextStatus,
      remarks: nextStatus === 'E' ? currentRecord.remarks : '',
    }));
    setFeedback(nextStatus === 'E'
      ? {
        variant: 'warning',
        title: 'Excused remark required',
        messages: ['Open this student’s details and add a remark before saving attendance.'],
      }
      : null);
    setLiveMessage(`${currentRecord.student.lastName}, ${currentRecord.student.firstName} changed to ${nextStatus}.`);
  };

  // Marks only unmarked rows Present and captures one local Undo snapshot.
  const handleMarkUnmarkedPresent = () => {
    if (!selectedSessionDraft || !isEditing) {
      return;
    }

    const nextDraft = markUnmarkedAsPresent(selectedSessionDraft);
    if (nextDraft === selectedSessionDraft) {
      setLiveMessage('No unmarked attendance rows remain.');
      return;
    }

    setUndoRecords(cloneAttendanceRecords(selectedSessionDraft.records));
    setSelectedDraft(nextDraft);
    setFeedback(null);
    setLiveMessage('All previously unmarked students changed to Present.');
  };

  // Restores the matrix captured immediately before the most recent local attendance action.
  const handleUndo = () => {
    if (!selectedSessionDraft || !undoRecords || !isEditing) {
      return;
    }

    setSelectedDraft({
      ...selectedSessionDraft,
      records: cloneAttendanceRecords(undoRecords),
    });
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage('The most recent attendance action was undone locally.');
  };

  // Discards the local working values and restores the last validated server response.
  const handleCancel = () => {
    if (!selectedSessionDraft) {
      return;
    }

    setSelectedDraft({
      ...selectedSessionDraft,
      records: cloneAttendanceRecords(selectedSessionDraft.savedRecords),
    });
    setEditingSessionId(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setFeedback({
      variant: 'info',
      title: 'Changes canceled',
      messages: ['The selected date was restored to its last saved server version.'],
    });
    setLiveMessage('Local attendance changes canceled.');
  };

  // Validates and atomically persists the selected session's complete roster.
  const handleSave = async () => {
    if (!selectedSessionDraft || !isEditing || isBusy) {
      return;
    }

    const validationIssues = validateAttendanceSessionDraft(selectedSessionDraft);
    if (validationIssues.length > 0) {
      setFeedback({
        variant: 'error',
        title: 'Attendance not saved',
        messages: validationIssues.map((issue) => issue.message),
      });
      setLiveMessage('Attendance could not be saved. Review the Excused remark errors.');
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const savedSession = await saveAttendanceSessionRecords(
        selectedSessionDraft.id,
        Object.values(selectedSessionDraft.records).map((record) => ({
          studentId: record.student.id,
          status: record.status,
          remarks: record.status === 'E' ? record.remarks.trim() : null,
        })),
      );
      const savedDraft = createAttendanceSessionDraft(savedSession);
      setSelectedDraft(savedDraft);
      setEditingSessionId(null);
      setUndoRecords(null);
      setDetailsTarget(null);
      setFeedback({
        variant: 'success',
        title: 'Attendance saved',
        messages: ['The complete roster, PALE statuses, and Excused remarks were persisted.'],
      });
      setLiveMessage(`${formatAttendanceDateLong(savedSession.sessionDate)} saved to PALE Records.`);
    } catch (error: unknown) {
      if (error instanceof AttendanceApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setFeedback({
        variant: 'error',
        title: 'Attendance not saved',
        messages: error instanceof AttendanceApiError
          ? getAttendanceApiMessages(error)
          : [error instanceof Error ? error.message : 'Unable to save attendance.'],
      });
      setLiveMessage('Attendance could not be saved. The local working copy is still available.');
    } finally {
      setIsSaving(false);
    }
  };

  // Applies dialog remarks as one local undoable action before the main sheet save.
  const handleApplyDetails = (record: WorkingAttendanceRecord) => {
    if (!selectedSessionDraft || !detailsTarget || !isEditing) {
      return;
    }

    setUndoRecords(cloneAttendanceRecords(selectedSessionDraft.records));
    setSelectedDraft(updateAttendanceRecord(selectedSessionDraft, detailsTarget.id, record));
    setDetailsTarget(null);
    setFeedback(null);
    setLiveMessage(`Attendance details applied for ${detailsTarget.lastName}, ${detailsTarget.firstName}.`);
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <header className="border-b border-paper-border bg-paper-light">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Workspace / Attendance
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
            Attendance
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
            Maintain persisted date-by-date registers from active classes and snapshotted student rosters.
          </p>
        </div>
      </header>

      <div className="archival-grid min-h-[calc(100vh-185px)] min-w-0">
        <div className="mx-auto min-w-0 max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          {loadStatus === 'loading' ? (
            <div className="border border-ink bg-paper-light px-5 py-10 text-center">
              <p role="status" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Loading attendance workspace…
              </p>
            </div>
          ) : null}

          {loadStatus === 'error' ? (
            <Notice variant="error" title="Attendance workspace unavailable">
              <div className="space-y-4">
                <p>{loadError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLoadStatus('loading');
                    setLoadError('');
                    setLoadAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try again
                </Button>
              </div>
            </Notice>
          ) : null}

          {loadStatus === 'ready' && classes.length === 0 ? (
            <div className="border border-ink bg-paper-light p-5 sm:p-8">
              <EmptyState
                icon={<AttendanceIcon />}
                title="No classes available"
                description="Add an active class before opening an attendance register."
                action={
                  <Button variant="secondary" onClick={() => navigate('/dashboard/classes')}>
                    Go to classes
                  </Button>
                }
                className="min-h-72"
              />
            </div>
          ) : null}

          {loadStatus === 'ready' && classes.length > 0 ? (
            <div className="min-w-0 space-y-8">
              <AttendanceToolbar
                classes={classes}
                selectedClassId={selectedClassId}
                dateInput={dateInput}
                selectedDate={selectedDate}
                selectedSession={selectedSessionDraft ?? null}
                isEditing={isEditing}
                hasUnsavedChanges={hasUnsavedChanges}
                isBusy={isBusy}
                isCreating={isCreating}
                isSaving={isSaving}
                canUndo={undoRecords !== null}
                canAddDate={canAddDate}
                dateHint={dateHint}
                statusCounts={statusCounts}
                feedback={toolbarFeedback}
                onClassChange={handleClassChange}
                onDateInputChange={setDateInput}
                onAddDate={handleAddDate}
                onEdit={handleEdit}
                onDelete={() => {
                  if (selectedSessionDraft) {
                    setDeleteTarget(selectedSessionDraft);
                  }
                }}
                onMarkUnmarkedPresent={handleMarkUnmarkedPresent}
                onUndo={handleUndo}
                onCancel={handleCancel}
                onSave={handleSave}
              />

              {!selectedClass ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No class selected"
                    description="Select an active class to load its saved Attendance sessions."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {selectedClass && sessionLoadStatus === 'loading' ? (
                <div className="border border-ink bg-paper-light px-5 py-10 text-center">
                  <p role="status" className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    Loading saved attendance sessions…
                  </p>
                </div>
              ) : null}

              {selectedClass && sessionLoadStatus === 'error' ? (
                <Notice variant="error" title="Saved attendance unavailable">
                  <div className="space-y-4">
                    <p>{sessionLoadError}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSessionLoadStatus('loading');
                        setSessionLoadError('');
                        setSessionLoadAttempt((attempt) => attempt + 1);
                      }}
                    >
                      Try again
                    </Button>
                  </div>
                </Notice>
              ) : null}

              {selectedClass &&
              sessionLoadStatus === 'ready' &&
              selectedClassSessions.length === 0 &&
              emptyRosterClassId === selectedClass.id ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No enrolled students"
                    description="This class needs an enrolled student before its first roster snapshot can be saved."
                    action={
                      <Button variant="secondary" onClick={() => navigate('/dashboard/students')}>
                        Go to students
                      </Button>
                    }
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {selectedClass &&
              sessionLoadStatus === 'ready' &&
              selectedClassSessions.length === 0 &&
              emptyRosterClassId !== selectedClass.id ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No saved attendance dates"
                    description="Choose a calendar date above to persist the first roster snapshot."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {selectedClass &&
              sessionLoadStatus === 'ready' &&
              selectedClassSessions.length > 0 &&
              selectedSessionId &&
              selectedRoster.length > 0 ? (
                <AttendanceRegister
                  roster={selectedRoster}
                  sessionDrafts={selectedClassSessions}
                  selectedSessionId={selectedSessionId}
                  isEditing={isEditing}
                  liveMessage={liveMessage}
                  onSelectSession={handleSelectSession}
                  onCycleStatus={handleCycleStatus}
                  onOpenDetails={setDetailsTarget}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {detailsTarget && selectedClass && selectedSessionDraft && detailsRecord ? (
        <AttendanceDetailsDialog
          key={`${selectedClass.id}-${selectedSessionDraft.id}-${detailsTarget.id}-${isEditing ? 'edit' : 'review'}`}
          student={detailsTarget}
          classRecord={selectedClass}
          date={selectedSessionDraft.sessionDate}
          record={detailsRecord}
          isEditable={isEditing}
          onClose={() => setDetailsTarget(null)}
          onApply={handleApplyDetails}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteAttendanceSessionDialog
          key={deleteTarget.id}
          session={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeletedSession}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
    </div>
  );
}
