// Owns Activity Recitation loading, local date selection, deliberate edits, and actions.
import { useEffect, useMemo, useState } from "react";
import { ClassApiError, fetchClasses } from "../../classes/classes-api";
import type { ClassRecord } from "../../classes/class-types";
import {
  createRecitationSession,
  listRecitationSessions,
  RecitationApiError,
  saveRecitationSessionRecords,
} from "./recitation-api";
import {
  cloneRecitationRecords,
  countRecitationMarks,
  createRecitationSessionDraft,
  createRecitationUndoSnapshot,
  cycleRecitationMark,
  formatRecitationDateLong,
  getRecitationMarkLabel,
  getRecitationMonthParts,
  getRecitationSessionRoster,
  isRecitationDateValue,
  isRecitationSessionDirty,
  sortRecitationSessionDrafts,
  updateRecitationMark,
} from "./recitation-draft";
import type {
  RecitationSessionDraft,
  RecitationUndoSnapshot,
} from "./recitation-types";
import type { DateFormatPreference } from "../../settings/preference-display";

type LoadStatus = "loading" | "ready" | "error";
type SessionLoadStatus = "idle" | "loading" | "ready" | "error";

export interface RecitationFeedbackState {
  variant: "error" | "info" | "success" | "warning";
  title: string;
  messages: string[];
}

// Formats the browser's current local month for the native month control.
function getCurrentRecitationMonth() {
  const today = new Date();
  return `${today.getFullYear().toString().padStart(4, "0")}-${(today.getMonth() + 1).toString().padStart(2, "0")}`;
}

// Replaces one current-month draft while preserving chronological columns.
function replaceRecitationSessionDraft(
  sessionDrafts: RecitationSessionDraft[],
  nextDraft: RecitationSessionDraft,
) {
  const hasSession = sessionDrafts.some(
    (session) => session.id === nextDraft.id,
  );
  const nextSessions = hasSession
    ? sessionDrafts.map((session) =>
        session.id === nextDraft.id ? nextDraft : session,
      )
    : [...sessionDrafts, nextDraft];
  return sortRecitationSessionDrafts(nextSessions);
}

// Collects safe server field and form messages without duplicating the primary error.
function getRecitationApiMessages(error: RecitationApiError) {
  return [
    ...new Set([
      error.message,
      ...error.formErrors,
      ...Object.values(error.fieldErrors).flat(),
    ]),
  ];
}

// Coordinates one selected class/month with one selected Recitation working copy.
export function useRecitationWorkspace(
  onSessionExpired: () => void,
  dateFormat?: DateFormatPreference,
) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [monthInput, setMonthInput] = useState(getCurrentRecitationMonth);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [sessionLoadStatus, setSessionLoadStatus] =
    useState<SessionLoadStatus>("idle");
  const [sessionLoadError, setSessionLoadError] = useState("");
  const [sessionLoadAttempt, setSessionLoadAttempt] = useState(0);
  const [sessionDrafts, setSessionDrafts] = useState<RecitationSessionDraft[]>(
    [],
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [undoRecords, setUndoRecords] = useState<RecitationUndoSnapshot | null>(
    null,
  );
  const [feedback, setFeedback] = useState<RecitationFeedbackState | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<RecitationSessionDraft | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchClasses(controller.signal)
      .then((classRecords) => {
        setClasses(classRecords);
        setLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (error instanceof ClassApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load the Activity workspace.";
        setLoadError(message);
        setLoadStatus("error");
        setLiveMessage(`Activity workspace failed to load. ${message}`);
      });

    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  useEffect(() => {
    const month = getRecitationMonthParts(monthInput);
    if (!selectedClassId || !month) {
      return undefined;
    }

    const controller = new AbortController();

    listRecitationSessions(
      selectedClassId,
      month.year,
      month.month,
      controller.signal,
    )
      .then((sessions) => {
        const nextDrafts = sortRecitationSessionDrafts(
          sessions.map(createRecitationSessionDraft),
        );
        const newestSession = nextDrafts.at(-1);
        setSessionDrafts(nextDrafts);
        setSelectedSessionId(newestSession?.id ?? null);
        setEditingSessionId(null);
        setUndoRecords(null);
        setSessionLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (error instanceof RecitationApiError && error.status === 401) {
          onSessionExpired();
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load Recitation dates for this month.";
        setSessionLoadError(message);
        setSessionLoadStatus("error");
        setLiveMessage(`Recitation month failed to load. ${message}`);
      });

    return () => controller.abort();
  }, [monthInput, onSessionExpired, selectedClassId, sessionLoadAttempt]);

  const selectedClass = useMemo(
    () =>
      classes.find((classRecord) => classRecord.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const selectedSessionDraft = sessionDrafts.find(
    (sessionDraft) => sessionDraft.id === selectedSessionId,
  );
  const selectedRoster = useMemo(
    () => getRecitationSessionRoster(selectedSessionDraft),
    [selectedSessionDraft],
  );
  const selectedDate = selectedSessionDraft?.sessionDate ?? null;
  const isEditing =
    selectedSessionId !== null && editingSessionId === selectedSessionId;
  const hasUnsavedChanges =
    isEditing && isRecitationSessionDirty(selectedSessionDraft);
  const markCounts = countRecitationMarks(selectedSessionDraft);
  const isBusy = sessionLoadStatus === "loading" || isCreating || isSaving;
  const existingDates = useMemo(
    () => sessionDrafts.map((session) => session.sessionDate),
    [sessionDrafts],
  );
  const canSelectDates = Boolean(
    selectedClass &&
    sessionLoadStatus === "ready" &&
    !hasUnsavedChanges &&
    !isBusy,
  );
  const canAddDates = Boolean(
    selectedClass &&
    sessionLoadStatus === "ready" &&
    selectedDates.length > 0 &&
    !hasUnsavedChanges &&
    !isBusy,
  );
  const hasSelectedDates = selectedDates.length > 0;

  useEffect(() => {
    if (!hasUnsavedChanges && !hasSelectedDates) {
      return undefined;
    }

    // Protects the only unsaved local working copy on refresh or close.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasSelectedDates, hasUnsavedChanges]);

  // Clears selected-date editing state when the current class or month changes.
  const resetSelectedSession = () => {
    setSessionDrafts([]);
    setSelectedSessionId(null);
    setEditingSessionId(null);
    setUndoRecords(null);
  };

  // Replaces only the selected session's working and server snapshots.
  const setSelectedDraft = (sessionDraft: RecitationSessionDraft) => {
    setSessionDrafts((currentDrafts) =>
      replaceRecitationSessionDraft(currentDrafts, sessionDraft),
    );
  };

  // Restarts the active-class request after a recoverable failure.
  const handleRetryLoad = () => {
    setLoadStatus("loading");
    setLoadError("");
    setLoadAttempt((attempt) => attempt + 1);
  };

  // Confirms a selection loss before moving the calendar to another class or month.
  const confirmSelectedDateDiscard = (destination: "class" | "month") => {
    if (!hasSelectedDates) {
      return true;
    }

    const confirmed = window.confirm(
      `Discard ${selectedDates.length} selected Recitation ${selectedDates.length === 1 ? "date" : "dates"} before changing ${destination}?`,
    );
    if (!confirmed) {
      setFeedback({
        variant: "info",
        title: "Selected dates kept",
        messages: ["The calendar selection was not changed."],
      });
      setLiveMessage("Class or month change canceled. Selected Recitation dates were kept.");
    }
    return confirmed;
  };

  // Refuses a dirty class switch and otherwise starts the selected month request.
  const handleClassChange = (classId: string) => {
    if (classId === selectedClassId) {
      return;
    }

    if (hasUnsavedChanges) {
      setFeedback({
        variant: "warning",
        title: "Unsaved Recitation changes",
        messages: [
          "Save Recitation or cancel changes before switching classes.",
        ],
      });
      setLiveMessage(
        "Class switch blocked because the selected Recitation date has unsaved changes.",
      );
      return;
    }

    if (!confirmSelectedDateDiscard("class")) {
      return;
    }

    setSelectedClassId(classId);
    setSelectedDates([]);
    setSessionLoadStatus(classId ? "loading" : "idle");
    setSessionLoadError("");
    resetSelectedSession();
    setFeedback(null);
    setLiveMessage(
      classId
        ? "Class selected. Loading its Recitation month."
        : "Class selection cleared.",
    );
  };

  // Refuses a dirty month switch and validates the bounded native month value.
  const handleMonthChange = (month: string) => {
    if (month === monthInput) {
      return;
    }

    if (hasUnsavedChanges) {
      setFeedback({
        variant: "warning",
        title: "Unsaved Recitation changes",
        messages: [
          "Save Recitation or cancel changes before switching months.",
        ],
      });
      setLiveMessage(
        "Month switch blocked because the selected Recitation date has unsaved changes.",
      );
      return;
    }

    if (!confirmSelectedDateDiscard("month")) {
      return;
    }

    if (!getRecitationMonthParts(month)) {
      setFeedback({
        variant: "error",
        title: "Calendar month required",
        messages: ["Choose a month between January 2000 and December 2100."],
      });
      setLiveMessage("The requested calendar month is invalid.");
      return;
    }

    setMonthInput(month);
    setSelectedDates([]);
    setSessionLoadStatus(selectedClassId ? "loading" : "idle");
    setSessionLoadError("");
    resetSelectedSession();
    setFeedback(null);
    setLiveMessage("Calendar month changed. Loading Recitation dates.");
  };

  // Toggles one available date in the local selection without writing records.
  const handleToggleSelectedDate = (date: string) => {
    if (
      !canSelectDates ||
      !isRecitationDateValue(date) ||
      date.slice(0, 7) !== monthInput
    ) {
      return;
    }

    if (existingDates.includes(date)) {
      return;
    }

    if (selectedDates.includes(date)) {
      setSelectedDates((currentDates) =>
        currentDates.filter((currentDate) => currentDate !== date),
      );
      setFeedback(null);
      setLiveMessage(
        `${formatRecitationDateLong(date, dateFormat)} removed from selected Recitation dates.`,
      );
      return;
    }

    if (selectedDates.length >= 31) {
      setFeedback({
        variant: "warning",
        title: "Date selection limit reached",
        messages: ["Select at most 31 Recitation dates at a time."],
      });
      setLiveMessage("Recitation date selection is limited to 31 dates.");
      return;
    }

    setSelectedDates((currentDates) => [...currentDates, date].sort());
    setFeedback(null);
    setLiveMessage(`${formatRecitationDateLong(date, dateFormat)} selected for Recitation.`);
  };

  // Removes one local date selection and leaves persisted sessions unchanged.
  const handleRemoveSelectedDate = (date: string) => {
    if (isBusy) {
      return;
    }

    setSelectedDates((currentDates) =>
      currentDates.filter((currentDate) => currentDate !== date),
    );
    setFeedback(null);
    setLiveMessage(
      `${formatRecitationDateLong(date, dateFormat)} removed from selected Recitation dates.`,
    );
  };

  // Clears only local date selections and leaves persisted sessions unchanged.
  const handleClearSelectedDates = () => {
    if (isBusy || selectedDates.length === 0) {
      return;
    }

    setSelectedDates([]);
    setFeedback(null);
    setLiveMessage(
      "Selected Recitation dates cleared. No saved dates were changed.",
    );
  };

  // Creates each requested manual date, then reconciles any concurrent duplicates once.
  const handleAddDates = async () => {
    if (!selectedClass || selectedDates.length === 0) {
      setFeedback({
        variant: "error",
        title: "Recitation date required",
        messages: [
          "Choose an active class and at least one Recitation date.",
        ],
      });
      setLiveMessage(
        "Recitation date creation failed because no valid dates were selected.",
      );
      return;
    }

    if (hasUnsavedChanges) {
      setFeedback({
        variant: "warning",
        title: "Unsaved Recitation changes",
        messages: ["Save Recitation or cancel changes before adding dates."],
      });
      setLiveMessage(
        "Date creation blocked because the selected Recitation date has unsaved changes.",
      );
      return;
    }

    if (isBusy || sessionLoadStatus !== "ready") {
      setFeedback({
        variant: "info",
        title: "Recitation month is loading",
        messages: [
          "Wait for the selected class month to finish loading before adding dates.",
        ],
      });
      setLiveMessage(
        "Date creation is unavailable while the Recitation month is loading.",
      );
      return;
    }

    const month = getRecitationMonthParts(monthInput);
    if (
      !month ||
      selectedDates.some((date) => date.slice(0, 7) !== monthInput)
    ) {
      setFeedback({
        variant: "error",
        title: "One calendar month required",
        messages: [
          "Select Recitation dates from the currently selected month only.",
        ],
      });
      setLiveMessage(
        "Recitation dates were not added because their month did not match.",
      );
      return;
    }

    const requestedDates = [...selectedDates];
    const knownSessionsByDate = new Map(
      sessionDrafts.map((session) => [session.sessionDate, session]),
    );
    const completedDates = new Set<string>();
    const createdDrafts: RecitationSessionDraft[] = [];
    let shouldReloadMonth = false;
    let failedDate: string | null = null;
    let failureMessages: string[] = [];
    let reloadMessage = "";

    setIsCreating(true);
    setFeedback(null);
    try {
      for (const sessionDate of requestedDates) {
        if (knownSessionsByDate.has(sessionDate)) {
          completedDates.add(sessionDate);
          continue;
        }

        try {
          const session = await createRecitationSession(
            selectedClass.id,
            sessionDate,
          );
          const sessionDraft = createRecitationSessionDraft(session);
          createdDrafts.push(sessionDraft);
          completedDates.add(sessionDate);
          shouldReloadMonth = true;
        } catch (error: unknown) {
          if (error instanceof RecitationApiError && error.status === 401) {
            onSessionExpired();
            return;
          }

          if (
            error instanceof RecitationApiError &&
            error.code === "RECITATION_SESSION_EXISTS"
          ) {
            completedDates.add(sessionDate);
            shouldReloadMonth = true;
            continue;
          }

          failedDate = sessionDate;
          failureMessages = (
            error instanceof RecitationApiError
              ? getRecitationApiMessages(error)
              : [
                  error instanceof Error
                    ? error.message
                    : "Unable to create this Recitation date.",
                ]
          ).map(
            (message) => `${formatRecitationDateLong(sessionDate, dateFormat)}: ${message}`,
          );
          shouldReloadMonth = true;
          break;
        }
      }

      let nextDrafts = createdDrafts.reduce(
        (drafts, sessionDraft) =>
          replaceRecitationSessionDraft(drafts, sessionDraft),
        sessionDrafts,
      );

      if (shouldReloadMonth) {
        setSessionLoadStatus("loading");
        try {
          const sessions = await listRecitationSessions(
            selectedClass.id,
            month.year,
            month.month,
            new AbortController().signal,
          );
          nextDrafts = sortRecitationSessionDrafts(
            sessions.map(createRecitationSessionDraft),
          );
          for (const requestedDate of requestedDates) {
            if (
              nextDrafts.some(
                (session) => session.sessionDate === requestedDate,
              )
            ) {
              completedDates.add(requestedDate);
            }
          }
          if (failedDate && completedDates.has(failedDate)) {
            failureMessages = [];
          }
          setSessionLoadError("");
          setSessionLoadStatus("ready");
        } catch (error: unknown) {
          if (error instanceof RecitationApiError && error.status === 401) {
            onSessionExpired();
            return;
          }

          reloadMessage =
            error instanceof Error
              ? `The month could not be refreshed: ${error.message}`
              : "The month could not be refreshed after adding dates.";
          setSessionLoadError(reloadMessage);
          setSessionLoadStatus("error");
        }
      }

      setSessionDrafts(nextDrafts);
      setSelectedDates((currentDates) =>
        currentDates.filter((selectedDate) => !completedDates.has(selectedDate)),
      );

      const createdTarget = sortRecitationSessionDrafts(createdDrafts).at(-1);
      const completedTarget = nextDrafts
        .filter((session) => completedDates.has(session.sessionDate))
        .at(-1);
      const nextSelectedSession = createdTarget
        ? nextDrafts.find((session) => session.id === createdTarget.id)
        : completedTarget;
      if (nextSelectedSession) {
        setSelectedSessionId(nextSelectedSession.id);
        setEditingSessionId(createdTarget ? nextSelectedSession.id : null);
        setUndoRecords(null);
      }

      const createdCount = createdDrafts.length;
      const existingCount = completedDates.size - createdCount;
      const remainingDates = requestedDates.filter(
        (requestedDate) => !completedDates.has(requestedDate),
      );
      const outcomeMessages: string[] = [];
      if (createdCount > 0) {
        outcomeMessages.push(
          `${createdCount} ${createdCount === 1 ? "date was" : "dates were"} created.`,
        );
      }
      if (existingCount > 0) {
        outcomeMessages.push(
          `${existingCount} ${existingCount === 1 ? "date already existed" : "dates already existed"} and no duplicates were created.`,
        );
      }
      if (remainingDates.length > 0) {
        outcomeMessages.push(
          `${remainingDates.length} ${remainingDates.length === 1 ? "date remains" : "dates remain"} selected for another attempt.`,
        );
      }
      outcomeMessages.push(...failureMessages);
      if (reloadMessage) {
        outcomeMessages.push(reloadMessage);
      }

      const hasIncompleteDates =
        remainingDates.length > 0 || Boolean(reloadMessage);
      setFeedback({
        variant: hasIncompleteDates
          ? completedDates.size > 0
            ? "warning"
            : "error"
          : createdCount > 0
            ? "success"
            : "info",
        title: hasIncompleteDates
          ? "Some Recitation dates need attention"
          : createdCount > 0
            ? createdCount === 1
              ? "Recitation date created"
              : "Recitation dates created"
            : "Recitation dates already exist",
        messages: outcomeMessages,
      });
      setLiveMessage(
        hasIncompleteDates
          ? `${completedDates.size} Recitation dates are available; ${remainingDates.length} remain selected.`
          : `${completedDates.size} Recitation ${completedDates.size === 1 ? "date is" : "dates are"} available.`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Restarts current-month loading after a recoverable request failure.
  const handleRetrySessionLoad = () => {
    setSessionLoadStatus("loading");
    setSessionLoadError("");
    setSessionLoadAttempt((attempt) => attempt + 1);
  };

  // Selects another date without abandoning a dirty working copy.
  const handleSelectSession = (sessionId: string) => {
    if (sessionId === selectedSessionId || isBusy) {
      return;
    }

    if (hasUnsavedChanges) {
      setFeedback({
        variant: "warning",
        title: "Unsaved Recitation changes",
        messages: ["Save Recitation or cancel changes before switching dates."],
      });
      setLiveMessage(
        "Date switch blocked because the selected Recitation date has unsaved changes.",
      );
      return;
    }

    const nextSession = sessionDrafts.find(
      (session) => session.id === sessionId,
    );
    if (!nextSession) {
      return;
    }

    setSelectedSessionId(sessionId);
    setEditingSessionId(null);
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage(
      `${formatRecitationDateLong(nextSession.sessionDate, dateFormat)} selected in read-only mode.`,
    );
  };

  // Starts editing from a fresh copy of the last validated server snapshot.
  const handleEdit = () => {
    if (!selectedSessionDraft || !selectedSessionId || isBusy) {
      return;
    }

    setSelectedDraft({
      ...selectedSessionDraft,
      records: cloneRecitationRecords(selectedSessionDraft.savedRecords),
    });
    setEditingSessionId(selectedSessionId);
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage(
      `${formatRecitationDateLong(selectedSessionDraft.sessionDate, dateFormat)} is now editable.`,
    );
  };

  // Opens destructive confirmation for the selected date while it is editable.
  const handleOpenDelete = () => {
    if (selectedSessionDraft && isEditing && !isBusy) {
      setDeleteTarget(selectedSessionDraft);
    }
  };

  // Closes deletion confirmation without changing saved or local Recitation data.
  const handleCloseDelete = () => {
    setDeleteTarget(null);
  };

  // Removes the deleted date locally and selects the newest remaining date.
  const handleDeletedSession = (sessionId: string) => {
    const remainingSessions = sessionDrafts.filter(
      (sessionDraft) => sessionDraft.id !== sessionId,
    );

    setSessionDrafts(remainingSessions);
    setSelectedSessionId(remainingSessions.at(-1)?.id ?? null);
    setEditingSessionId(null);
    setUndoRecords(null);
    setDeleteTarget(null);
    setFeedback({
      variant: "success",
      title: "Recitation date deleted",
      messages: [
        hasUnsavedChanges
          ? "The complete date and its saved roster marks were deleted. Local unsaved edits were discarded."
          : "The complete date and its saved roster marks were deleted.",
      ],
    });
    setLiveMessage("The selected Recitation date was deleted.");
  };

  // Applies one mark cycle step and captures exactly one Undo snapshot.
  const handleCycleMark = (studentId: string) => {
    if (!selectedSessionDraft || !isEditing || isBusy) {
      return;
    }

    const currentRecord = selectedSessionDraft.records[studentId];
    if (!currentRecord) {
      return;
    }

    const nextMark = cycleRecitationMark(currentRecord.mark);
    setUndoRecords(createRecitationUndoSnapshot(selectedSessionDraft.records));
    setSelectedDraft(
      updateRecitationMark(selectedSessionDraft, studentId, nextMark),
    );
    setFeedback(null);
    setLiveMessage(
      `${currentRecord.student.lastName}, ${currentRecord.student.firstName} changed from ${getRecitationMarkLabel(currentRecord.mark)} to ${getRecitationMarkLabel(nextMark)}.`,
    );
  };

  // Restores the snapshot immediately before the most recent local mark change.
  const handleUndo = () => {
    if (!selectedSessionDraft || !undoRecords || !isEditing || isBusy) {
      return;
    }

    setSelectedDraft({
      ...selectedSessionDraft,
      records: cloneRecitationRecords(undoRecords),
    });
    setUndoRecords(null);
    setFeedback(null);
    setLiveMessage(
      "The most recent Recitation mark change was undone locally.",
    );
  };

  // Discards the local working marks and restores the last validated server snapshot.
  const handleCancel = () => {
    if (!selectedSessionDraft || isBusy) {
      return;
    }

    setSelectedDraft({
      ...selectedSessionDraft,
      records: cloneRecitationRecords(selectedSessionDraft.savedRecords),
    });
    setEditingSessionId(null);
    setUndoRecords(null);
    setFeedback({
      variant: "info",
      title: "Recitation changes canceled",
      messages: [
        selectedSessionDraft.isRosterInitialized
          ? "The selected date was restored to its last saved server version."
          : "The response-only roster draft was restored to Unmarked without creating records.",
      ],
    });
    setLiveMessage("Local Recitation changes canceled.");
  };

  // Saves every selected roster student once, including real null marks.
  const handleSave = async () => {
    if (!selectedSessionDraft || !isEditing || isBusy) {
      return;
    }

    const wasRosterInitialized = selectedSessionDraft.isRosterInitialized;
    setIsSaving(true);
    setFeedback(null);
    try {
      const savedSession = await saveRecitationSessionRecords(
        selectedSessionDraft,
        Object.values(selectedSessionDraft.records)
          .toSorted((first, second) =>
            first.student.id.localeCompare(second.student.id),
          )
          .map((record) => ({
            studentId: record.student.id,
            mark: record.mark,
          })),
      );
      const savedDraft = createRecitationSessionDraft(savedSession);
      setSelectedDraft(savedDraft);
      setEditingSessionId(null);
      setUndoRecords(null);
      setFeedback({
        variant: "success",
        title: "Recitation saved",
        messages: [
          wasRosterInitialized
            ? "The complete stored historical roster and its marks were updated."
            : "The complete current enrollment became this date’s historical roster, including Unmarked students.",
        ],
      });
      setLiveMessage(
        `${formatRecitationDateLong(savedSession.sessionDate, dateFormat)} Recitation saved.`,
      );
    } catch (error: unknown) {
      if (error instanceof RecitationApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      const messages =
        error instanceof RecitationApiError
          ? getRecitationApiMessages(error)
          : [
              error instanceof Error
                ? error.message
                : "Unable to save Recitation.",
            ];
      setFeedback({
        variant: "error",
        title: "Recitation not saved",
        messages,
      });
      setLiveMessage(
        `Recitation save failed. ${messages[0]} The local working copy is still available.`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    classes,
    loadStatus,
    loadError,
    selectedClassId,
    monthInput,
    selectedDates,
    pendingDateCount: selectedDates.length,
    existingDates,
    sessionLoadStatus,
    sessionLoadError,
    selectedClass,
    sessionDrafts,
    selectedSessionId,
    selectedSessionDraft,
    selectedRoster,
    selectedDate,
    isEditing,
    hasUnsavedChanges,
    markCounts,
    isBusy,
    isCreating,
    isSaving,
    canUndo: undoRecords !== null,
    canSelectDates,
    canAddDates,
    feedback,
    deleteTarget,
    liveMessage,
    handleRetryLoad,
    handleClassChange,
    handleMonthChange,
    handleToggleSelectedDate,
    handleRemoveSelectedDate,
    handleClearSelectedDates,
    handleAddDates,
    handleRetrySessionLoad,
    handleSelectSession,
    handleEdit,
    handleOpenDelete,
    handleCloseDelete,
    handleDeletedSession,
    handleCycleMark,
    handleUndo,
    handleCancel,
    handleSave,
  };
}
