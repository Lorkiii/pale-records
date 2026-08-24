// Composes real class rosters with a mounted-page-only attendance editing workspace.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import {
  cloneAttendanceRecords,
  countAttendanceStatuses,
  createAttendanceDateDraft,
  cycleAttendanceStatus,
  filterAndSortRoster,
  formatAttendanceDateLong,
  isAttendanceDateDirty,
  isAttendanceDateValue,
  markUnmarkedAsPresent,
  sortAttendanceDateDrafts,
  updateAttendanceRecord,
  validateAttendanceDateDraft,
} from '../features/attendance/attendance-draft';
import { AttendanceDetailsDialog } from '../features/attendance/components/AttendanceDetailsDialog';
import { AttendanceRegister } from '../features/attendance/components/AttendanceRegister';
import {
  AttendanceToolbar,
  type AttendanceToolbarFeedback,
} from '../features/attendance/components/AttendanceToolbar';
import type {
  AttendanceDateDraft,
  AttendanceDraftRecord,
  AttendanceRecordsByStudentId,
} from '../features/attendance/attendance-types';
import { ClassApiError, fetchClasses } from '../features/classes/classes-api';
import type { ClassRecord } from '../features/classes/class-types';
import { fetchStudents, StudentApiError } from '../features/students/students-api';
import type { StudentRecord } from '../features/students/student-types';

interface AttendancePageProps {
  onSessionExpired: () => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';
type AttendanceDraftsByClassId = Record<string, AttendanceDateDraft[]>;

interface FeedbackState {
  variant: AttendanceToolbarFeedback['variant'];
  title: string;
  messages: string[];
}

const EMPTY_ATTENDANCE_RECORD: AttendanceDraftRecord = {
  status: null,
  remarks: '',
  proof: null,
};

// Replaces one date inside its class collection while preserving chronological columns.
function replaceClassDateDraft(
  draftsByClassId: AttendanceDraftsByClassId,
  classId: string,
  dateDraft: AttendanceDateDraft,
) {
  const currentDates = draftsByClassId[classId] ?? [];
  return {
    ...draftsByClassId,
    [classId]: sortAttendanceDateDrafts(
      currentDates.map((currentDraft) =>
        currentDraft.date === dateDraft.date ? dateDraft : currentDraft,
      ),
    ),
  };
}

// Provides the attendance symbol used by honest empty workspace states.
function AttendanceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" />
      <path d="M8 3v4M16 3v4M4 9h16M8 15l2 2 5-5" />
    </svg>
  );
}

// Coordinates real roster loading and all temporary attendance snapshots in mounted page state.
export function AttendancePage({ onSessionExpired }: AttendancePageProps) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draftsByClassId, setDraftsByClassId] = useState<AttendanceDraftsByClassId>({});
  const [undoRecords, setUndoRecords] = useState<AttendanceRecordsByStudentId | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<StudentRecord | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchClasses(controller.signal),
      fetchStudents(controller.signal),
    ])
      .then(([classRecords, studentRecords]) => {
        setClasses(classRecords);
        setStudents(studentRecords);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (
          (error instanceof ClassApiError || error instanceof StudentApiError) &&
          error.status === 401
        ) {
          onSessionExpired();
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to load the attendance workspace.');
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  const selectedClass = useMemo(
    () => classes.find((classRecord) => classRecord.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const selectedRoster = useMemo(
    () => selectedClassId ? filterAndSortRoster(students, selectedClassId) : [],
    [selectedClassId, students],
  );
  const selectedClassDates = useMemo(
    () => sortAttendanceDateDrafts(draftsByClassId[selectedClassId] ?? []),
    [draftsByClassId, selectedClassId],
  );
  const selectedDateDraft = selectedClassDates.find(
    (dateDraft) => dateDraft.date === selectedDate,
  );
  const isEditing = selectedDate !== null && editingDate === selectedDate;
  const hasUnsavedChanges = isEditing && isAttendanceDateDirty(selectedDateDraft);
  const statusCounts = countAttendanceStatuses(selectedDateDraft, selectedRoster);
  const canAddDate = Boolean(
    selectedClass &&
    selectedRoster.length > 0 &&
    isAttendanceDateValue(dateInput) &&
    !hasUnsavedChanges,
  );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    // Asks the browser to protect the only unsaved page-memory draft on refresh or close.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const dateHint = !selectedClass
    ? 'Select a class before adding an attendance date.'
    : selectedRoster.length === 0
      ? 'This class has no enrolled students to mark.'
      : 'Dates are stored as local calendar days in this page only.';

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

  // Updates only the currently selected date in its class-local page-memory collection.
  const setSelectedDraft = (dateDraft: AttendanceDateDraft) => {
    setDraftsByClassId((currentDrafts) =>
      replaceClassDateDraft(currentDrafts, selectedClassId, dateDraft),
    );
  };

  // Refuses a class switch while a date has unsaved changes, otherwise restores that class view.
  const handleClassChange = (classId: string) => {
    if (hasUnsavedChanges) {
      setFeedback({
        variant: 'warning',
        title: 'Unsaved attendance',
        messages: ['Save attendance or cancel changes before switching classes.'],
      });
      return;
    }

    const nextDates = sortAttendanceDateDrafts(draftsByClassId[classId] ?? []);
    setSelectedClassId(classId);
    setSelectedDate(nextDates[0]?.date ?? null);
    setEditingDate(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setFeedback(null);
  };

  // Creates a new unsaved date or selects the existing date instead of duplicating it.
  const handleAddDate = () => {
    if (!selectedClass) {
      setFeedback({
        variant: 'warning',
        title: 'Select a class',
        messages: ['Choose an active class before adding an attendance date.'],
      });
      return;
    }

    if (selectedRoster.length === 0) {
      setFeedback({
        variant: 'warning',
        title: 'No enrolled students',
        messages: ['This class needs an enrolled student before an attendance date can be created.'],
      });
      return;
    }

    if (!isAttendanceDateValue(dateInput)) {
      setFeedback({
        variant: 'error',
        title: 'Attendance date required',
        messages: ['Choose a valid calendar date.'],
      });
      return;
    }

    const existingDate = selectedClassDates.find((dateDraft) => dateDraft.date === dateInput);
    if (existingDate) {
      if (hasUnsavedChanges && selectedDate !== existingDate.date) {
        setFeedback({
          variant: 'warning',
          title: 'Unsaved attendance',
          messages: ['Save attendance or cancel changes before switching dates.'],
        });
        return;
      }

      setSelectedDate(existingDate.date);
      setEditingDate(existingDate.savedRecords === null ? existingDate.date : null);
      setUndoRecords(null);
      setFeedback({
        variant: 'info',
        title: 'Date already added',
        messages: [`${formatAttendanceDateLong(existingDate.date)} was selected without creating a duplicate.`],
      });
      return;
    }

    const newDateDraft = createAttendanceDateDraft(dateInput, selectedRoster);
    setDraftsByClassId((currentDrafts) => ({
      ...currentDrafts,
      [selectedClassId]: sortAttendanceDateDrafts([
        ...(currentDrafts[selectedClassId] ?? []),
        newDateDraft,
      ]),
    }));
    setSelectedDate(dateInput);
    setEditingDate(dateInput);
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage(`${formatAttendanceDateLong(dateInput)} added and ready to edit.`);
  };

  // Selects a saved date for review but never abandons the active working copy.
  const handleSelectDate = (date: string) => {
    if (date === selectedDate) {
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

    setSelectedDate(date);
    setEditingDate(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setFeedback(null);
    setLiveMessage(`${formatAttendanceDateLong(date)} selected in read-only mode.`);
  };

  // Unlocks only the selected saved date for deliberate edits.
  const handleEdit = () => {
    if (!selectedDateDraft || !selectedDate) {
      return;
    }

    setEditingDate(selectedDate);
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage(`${formatAttendanceDateLong(selectedDate)} is now editable.`);
  };

  // Applies one exact PALE cycle step while retaining any existing excuse details.
  const handleCycleStatus = (studentId: string) => {
    if (!selectedDateDraft || !isEditing) {
      return;
    }

    const currentRecord = selectedDateDraft.records[studentId] ?? EMPTY_ATTENDANCE_RECORD;
    const nextStatus = cycleAttendanceStatus(currentRecord.status);
    const student = selectedRoster.find((rosterStudent) => rosterStudent.id === studentId);
    setUndoRecords(cloneAttendanceRecords(selectedDateDraft.records));
    setSelectedDraft(updateAttendanceRecord(selectedDateDraft, studentId, {
      ...currentRecord,
      status: nextStatus,
    }));

    if (currentRecord.status === 'E' && (currentRecord.remarks.trim() || currentRecord.proof)) {
      setFeedback({
        variant: 'warning',
        title: 'Excuse details preserved',
        messages: ['The remark and proof remain attached. Return this record to E or remove those details before saving.'],
      });
    } else {
      setFeedback(null);
    }

    if (student) {
      setLiveMessage(`${student.lastName}, ${student.firstName} changed to ${nextStatus}.`);
    }
  };

  // Marks only unmarked rows Present and stores the previous matrix for one-step undo.
  const handleMarkUnmarkedPresent = () => {
    if (!selectedDateDraft || !isEditing) {
      return;
    }

    const nextDraft = markUnmarkedAsPresent(selectedDateDraft);
    if (nextDraft === selectedDateDraft) {
      setLiveMessage('No unmarked attendance rows remain.');
      return;
    }

    setUndoRecords(cloneAttendanceRecords(selectedDateDraft.records));
    setSelectedDraft(nextDraft);
    setFeedback(null);
    setLiveMessage('All previously unmarked students changed to Present.');
  };

  // Restores only the matrix captured immediately before the most recent attendance action.
  const handleUndo = () => {
    if (!selectedDateDraft || !undoRecords || !isEditing) {
      return;
    }

    setSelectedDraft({
      ...selectedDateDraft,
      records: cloneAttendanceRecords(undoRecords),
    });
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage('The most recent attendance action was undone.');
  };

  // Returns a saved date to its snapshot or removes a never-saved date entirely.
  const handleCancel = () => {
    if (!selectedDateDraft || !selectedDate) {
      return;
    }

    const savedRecords = selectedDateDraft.savedRecords;
    const isUnsavedDate = savedRecords === null;

    if (isUnsavedDate) {
      const remainingDates = selectedClassDates.filter(
        (dateDraft) => dateDraft.date !== selectedDate,
      );
      setDraftsByClassId((currentDrafts) => ({
        ...currentDrafts,
        [selectedClassId]: remainingDates,
      }));
      setSelectedDate(remainingDates[0]?.date ?? null);
    } else {
      setSelectedDraft({
        ...selectedDateDraft,
        records: cloneAttendanceRecords(savedRecords),
      });
    }

    setEditingDate(null);
    setUndoRecords(null);
    setDetailsTarget(null);
    setFeedback({
      variant: 'info',
      title: 'Changes canceled',
      messages: [isUnsavedDate
        ? 'The date had no saved page-memory snapshot, so the unsaved column was removed.'
        : 'The selected date was restored to its last page-memory snapshot.'],
    });
    setLiveMessage('Attendance changes canceled.');
  };

  // Validates excuse rules, commits one date to page memory, and returns it to read-only mode.
  const handleSave = () => {
    if (!selectedDateDraft || !selectedDate || !isEditing) {
      return;
    }

    const validationIssues = validateAttendanceDateDraft(selectedDateDraft, selectedRoster);
    if (validationIssues.length > 0) {
      setFeedback({
        variant: 'error',
        title: 'Attendance not saved',
        messages: validationIssues.map((issue) => issue.message),
      });
      setLiveMessage('Attendance could not be saved. Review the excuse detail errors.');
      return;
    }

    const committedRecords = cloneAttendanceRecords(selectedDateDraft.records);
    setSelectedDraft({
      ...selectedDateDraft,
      records: committedRecords,
      savedRecords: cloneAttendanceRecords(committedRecords),
    });
    setEditingDate(null);
    setUndoRecords(null);
    setFeedback({
      variant: 'success',
      title: 'Attendance saved in page memory',
      messages: ['Attendance saved in this page preview. It will reset when the page is refreshed.'],
    });
    setLiveMessage(`${formatAttendanceDateLong(selectedDate)} saved in this page preview.`);
  };

  // Applies dialog details as one undoable action without deleting evidence after a status change.
  const handleApplyDetails = (record: AttendanceDraftRecord) => {
    if (!selectedDateDraft || !detailsTarget || !isEditing) {
      return;
    }

    setUndoRecords(cloneAttendanceRecords(selectedDateDraft.records));
    setSelectedDraft(updateAttendanceRecord(selectedDateDraft, detailsTarget.id, record));
    setDetailsTarget(null);

    if (record.status !== 'E' && (record.remarks.trim() || record.proof)) {
      setFeedback({
        variant: 'warning',
        title: 'Excuse details need resolution',
        messages: ['The preserved details belong to an Excused record. Return the status to E or remove the details before saving.'],
      });
    } else {
      setFeedback(null);
    }

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
            Build a date-by-date class register from active classes and saved student enrollments.
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
                isEditing={isEditing}
                hasUnsavedChanges={hasUnsavedChanges}
                canUndo={undoRecords !== null}
                canAddDate={canAddDate}
                dateHint={dateHint}
                statusCounts={statusCounts}
                feedback={toolbarFeedback}
                onClassChange={handleClassChange}
                onDateInputChange={setDateInput}
                onAddDate={handleAddDate}
                onEdit={handleEdit}
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
                    description="Select an active class to load its saved student roster."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {selectedClass && selectedRoster.length === 0 ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No enrolled students"
                    description="This class has no saved students to include in the attendance register."
                    action={
                      <Button variant="secondary" onClick={() => navigate('/dashboard/students')}>
                        Go to students
                      </Button>
                    }
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {selectedClass && selectedRoster.length > 0 && selectedClassDates.length === 0 ? (
                <div className="border border-ink bg-paper-light p-5 sm:p-8">
                  <EmptyState
                    icon={<AttendanceIcon />}
                    title="No attendance dates added"
                    description="Choose a calendar date above to create the first page-memory attendance column."
                    className="min-h-56"
                  />
                </div>
              ) : null}

              {selectedClass && selectedRoster.length > 0 && selectedClassDates.length > 0 && selectedDate ? (
                <AttendanceRegister
                  roster={selectedRoster}
                  dateDrafts={selectedClassDates}
                  selectedDate={selectedDate}
                  isEditing={isEditing}
                  liveMessage={liveMessage}
                  onSelectDate={handleSelectDate}
                  onCycleStatus={handleCycleStatus}
                  onOpenDetails={setDetailsTarget}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {detailsTarget && selectedClass && selectedDate && selectedDateDraft ? (
        <AttendanceDetailsDialog
          key={`${selectedClass.id}-${selectedDate}-${detailsTarget.id}-${isEditing ? 'edit' : 'review'}`}
          student={detailsTarget}
          classRecord={selectedClass}
          date={selectedDate}
          record={selectedDateDraft.records[detailsTarget.id] ?? EMPTY_ATTENDANCE_RECORD}
          isEditable={isEditing}
          onClose={() => setDetailsTarget(null)}
          onApply={handleApplyDetails}
        />
      ) : null}
    </div>
  );
}
