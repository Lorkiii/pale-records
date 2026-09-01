// Owns Attendance page state, loading effects, derived values, and workflow handlers.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AttendanceApiError,
  createAttendanceSession,
  ensureAttendanceSessionMonth,
  saveAttendanceSessionRecords,
} from './attendance-api';
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
} from './attendance-draft';
import type {
  AttendanceSessionDraft,
  AttendanceStudentRecord,
  WorkingAttendanceRecord,
  WorkingAttendanceRecordsByStudentId,
} from './attendance-types';
import { ClassApiError, fetchClasses } from '../classes/classes-api';
import type { ClassRecord } from '../classes/class-types';
import type {
  DateFormatPreference,
} from '../settings/preference-display';
import type { SystemPreferences } from '../settings/settings-types';

type LoadStatus = 'loading' | 'ready' | 'error';
type SessionLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type AttendanceDraftsByClassId = Record<string, AttendanceSessionDraft[]>;

interface FeedbackState {
  variant: 'error' | 'info' | 'success' | 'warning';
  title: string;
  messages: string[];
}

const ATTENDANCE_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

// Formats the browser's current local month for the native month control.
function getCurrentAttendanceMonth() {
  const today = new Date();
  return `${today.getFullYear().toString().padStart(4, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
}

// Parses the bounded native month value without applying a timezone conversion.
function getAttendanceMonthParts(value: string) {
  const match = ATTENDANCE_MONTH_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
    ? { year, month }
    : null;
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

// Coordinates persisted sessions with one selected session's local working snapshots.
export function useAttendanceWorkspace(
  onSessionExpired: () => void,
  defaultAttendanceState?: SystemPreferences['defaultAttendanceState'],
  dateFormat?: DateFormatPreference,
) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [monthInput, setMonthInput] = useState(getCurrentAttendanceMonth);
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
  const defaultAttendanceStateRef = useRef(defaultAttendanceState);

  useEffect(() => {
    defaultAttendanceStateRef.current = defaultAttendanceState;
  }, [defaultAttendanceState]);

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
    const month = getAttendanceMonthParts(monthInput);
    if (!selectedClassId || !month) {
      return undefined;
    }

    const controller = new AbortController();

    ensureAttendanceSessionMonth(
      selectedClassId,
      month.year,
      month.month,
      controller.signal,
    )
      .then((sessions) => {
        const sessionDrafts = sortAttendanceSessionDrafts(
          sessions.map((session) => createAttendanceSessionDraft(
            session,
            defaultAttendanceStateRef.current,
          )),
        );
        setDraftsByClassId((currentDrafts) => ({
          ...currentDrafts,
          [selectedClassId]: sessionDrafts,
        }));
        setSelectedSessionId(sessions[0]?.id ?? null);
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
          : 'Unable to generate and load attendance dates for this month.');
        setSessionLoadStatus('error');
      });

    return () => controller.abort();
  }, [monthInput, onSessionExpired, selectedClassId, sessionLoadAttempt]);

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
      ? 'Generating and loading this month’s attendance dates…'
      : 'One persisted session is allowed per class and calendar date.';

  // Replaces only the selected session's local working and server snapshots.
  const setSelectedDraft = (sessionDraft: AttendanceSessionDraft) => {
    setDraftsByClassId((currentDrafts) =>
      replaceClassSessionDraft(currentDrafts, selectedClassId, sessionDraft),
    );
  };

  // Restarts the active-class request after a recoverable load failure.
  const handleRetryLoad = () => {
    setLoadStatus('loading');
    setLoadError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  // Refuses a class switch while dirty and otherwise starts generation for the selected month.
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
    setFeedback(null);
  };

  // Refuses a month switch while dirty and clears date-specific state before generation.
  const handleMonthChange = (month: string) => {
    if (hasUnsavedChanges) {
      setFeedback({
        variant: 'warning',
        title: 'Unsaved attendance',
        messages: ['Save attendance or cancel changes before switching months.'],
      });
      return;
    }

    if (!getAttendanceMonthParts(month)) {
      setFeedback({
        variant: 'error',
        title: 'Calendar month required',
        messages: ['Choose a month between January 2000 and December 2100.'],
      });
      return;
    }

    setMonthInput(month);
    setDateInput('');
    setSessionLoadStatus(selectedClassId && getAttendanceMonthParts(month) ? 'loading' : 'idle');
    setSessionLoadError('');
    setSelectedSessionId(null);
    setEditingSessionId(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setDeleteTarget(null);
    setFeedback(null);
  };

  // Keeps a manual date visible by opening its calendar month before creation.
  const handleDateInputChange = (date: string) => {
    setDateInput(date);
    const dateMonth = date.slice(0, 7);
    if (!hasUnsavedChanges && getAttendanceMonthParts(dateMonth) && dateMonth !== monthInput) {
      setMonthInput(dateMonth);
      setSessionLoadStatus(selectedClassId ? 'loading' : 'idle');
      setSessionLoadError('');
      setSelectedSessionId(null);
      setEditingSessionId(null);
      setUndoRecords(null);
      setDetailsTarget(null);
      setDeleteTarget(null);
      setFeedback(null);
    }
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
        messages: [`${formatAttendanceDateLong(dateInput, dateFormat)} was selected without creating a duplicate.`],
      });
      return;
    }

    setIsCreating(true);
    setFeedback(null);
    try {
      const session = await createAttendanceSession(selectedClass.id, dateInput);
      const sessionDraft = createAttendanceSessionDraft(
        session,
        defaultAttendanceStateRef.current,
      );
      setDraftsByClassId((currentDrafts) =>
        replaceClassSessionDraft(currentDrafts, selectedClass.id, sessionDraft),
      );
      setSelectedSessionId(session.id);
      setEditingSessionId(session.id);
      setUndoRecords(null);
      setFeedback({
        variant: 'success',
        title: 'Attendance date created',
        messages: ['The date was saved. Its current enrolled roster remains an unsaved draft until Save attendance.'],
      });
      setLiveMessage(`${formatAttendanceDateLong(session.sessionDate, dateFormat)} created and ready to edit.`);
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
          const month = getAttendanceMonthParts(monthInput);
          if (!month) {
            setFeedback({
              variant: 'error',
              title: 'Attendance reload failed',
              messages: ['Choose a valid calendar month before reloading attendance.'],
            });
            return;
          }
          const sessions = await ensureAttendanceSessionMonth(
            selectedClass.id,
            month.year,
            month.month,
            new AbortController().signal,
          );
          const sessionDrafts = sortAttendanceSessionDrafts(
            sessions.map((session) => createAttendanceSessionDraft(
              session,
              defaultAttendanceStateRef.current,
            )),
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
            messages: [`${formatAttendanceDateLong(dateInput, dateFormat)} was reloaded without creating a duplicate.`],
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

  // Restarts monthly attendance loading after a recoverable request failure.
  const handleRetrySessionLoad = () => {
    setSessionLoadStatus('loading');
    setSessionLoadError('');
    setSessionLoadAttempt((attempt) => attempt + 1);
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
      setLiveMessage(`${formatAttendanceDateLong(nextSession.sessionDate, dateFormat)} selected in read-only mode.`);
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
    setLiveMessage(`${formatAttendanceDateLong(selectedSessionDraft.sessionDate, dateFormat)} is now editable.`);
  };

  // Opens destructive confirmation for the currently selected saved session.
  const handleOpenDelete = () => {
    if (selectedSessionDraft) {
      setDeleteTarget(selectedSessionDraft);
    }
  };

  // Closes attendance deletion confirmation without changing saved data.
  const handleCloseDelete = () => {
    setDeleteTarget(null);
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
      messages: [selectedSessionDraft.isRosterInitialized
        ? 'The selected date was restored to its last saved server version.'
        : 'The draft roster was restored to its initial local values without creating attendance records.'],
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
        messages: ['The roster became this date’s historical snapshot, and all PALE statuses and Excused remarks were persisted.'],
      });
      setLiveMessage(`${formatAttendanceDateLong(savedSession.sessionDate, dateFormat)} saved to PALE Records.`);
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

  // Opens one student's attendance details for review or editing.
  const handleOpenDetails = (student: AttendanceStudentRecord) => {
    setDetailsTarget(student);
  };

  // Closes the details dialog without changing the selected working record.
  const handleCloseDetails = () => {
    setDetailsTarget(null);
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

  return {
    classes,
    loadStatus,
    loadError,
    selectedClassId,
    monthInput,
    dateInput,
    sessionLoadStatus,
    sessionLoadError,
    selectedClass,
    selectedClassSessions,
    selectedSessionId,
    selectedSessionDraft,
    selectedRoster,
    selectedDate,
    detailsTarget,
    detailsRecord,
    deleteTarget,
    isEditing,
    hasUnsavedChanges,
    statusCounts,
    isBusy,
    isCreating,
    isSaving,
    canUndo: undoRecords !== null,
    canAddDate,
    dateHint,
    feedback,
    liveMessage,
    handleRetryLoad,
    handleClassChange,
    handleMonthChange,
    handleDateInputChange,
    handleAddDate,
    handleRetrySessionLoad,
    handleSelectSession,
    handleEdit,
    handleOpenDelete,
    handleCloseDelete,
    handleDeletedSession,
    handleCycleStatus,
    handleMarkUnmarkedPresent,
    handleUndo,
    handleCancel,
    handleSave,
    handleOpenDetails,
    handleCloseDetails,
    handleApplyDetails,
  };
}
