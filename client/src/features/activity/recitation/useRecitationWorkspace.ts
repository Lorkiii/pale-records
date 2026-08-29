// Owns Activity Recitation loading, queued dates, deliberate edits, and actions.
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
export function useRecitationWorkspace(onSessionExpired: () => void) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [monthInput, setMonthInput] = useState(getCurrentRecitationMonth);
  const [dateInput, setDateInput] = useState("");
  const [queuedDates, setQueuedDates] = useState<string[]>([]);
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
  const pendingDates = useMemo(() => {
    const dates = new Set(queuedDates);
    if (
      isRecitationDateValue(dateInput) &&
      dateInput.slice(0, 7) === monthInput
    ) {
      dates.add(dateInput);
    }
    return [...dates].sort();
  }, [dateInput, monthInput, queuedDates]);
  const canQueueDate = Boolean(
    selectedClass &&
    sessionLoadStatus === "ready" &&
    isRecitationDateValue(dateInput) &&
    dateInput.slice(0, 7) === monthInput &&
    !queuedDates.includes(dateInput) &&
    !sessionDrafts.some((session) => session.sessionDate === dateInput) &&
    queuedDates.length < 31 &&
    !hasUnsavedChanges &&
    !isBusy,
  );
  const canAddDates = Boolean(
    selectedClass &&
    sessionLoadStatus === "ready" &&
    pendingDates.length > 0 &&
    !hasUnsavedChanges &&
    !isBusy,
  );
  const hasQueuedDates = queuedDates.length > 0;

  useEffect(() => {
    if (!hasUnsavedChanges && !hasQueuedDates) {
      return undefined;
    }

    // Protects the only unsaved local working copy on refresh or close.
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasQueuedDates, hasUnsavedChanges]);

  const dateHint = !selectedClass
    ? "Select a class before adding a Recitation date."
    : sessionLoadStatus === "loading"
      ? "Loading the selected month before date creation is available…"
      : hasQueuedDates
        ? `${queuedDates.length} ${queuedDates.length === 1 ? "date" : "dates"} queued for this month.`
        : "Choose a date to add now, or queue several dates from this month.";

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

    if (hasQueuedDates) {
      setFeedback({
        variant: "warning",
        title: "Queued Recitation dates",
        messages: ["Add or clear the queued dates before switching classes."],
      });
      setLiveMessage(
        "Class switch blocked because Recitation dates are still queued.",
      );
      return;
    }

    setSelectedClassId(classId);
    setDateInput("");
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

    if (hasQueuedDates) {
      setFeedback({
        variant: "warning",
        title: "Queued Recitation dates",
        messages: ["Add or clear the queued dates before switching months."],
      });
      setLiveMessage(
        "Month switch blocked because Recitation dates are still queued.",
      );
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
    setDateInput("");
    setSessionLoadStatus(selectedClassId ? "loading" : "idle");
    setSessionLoadError("");
    resetSelectedSession();
    setFeedback(null);
    setLiveMessage("Calendar month changed. Loading Recitation dates.");
  };

  // Keeps a valid manual date visible by moving the workspace to its month first.
  const handleDateInputChange = (date: string) => {
    if (date === dateInput) {
      return;
    }

    if (hasUnsavedChanges) {
      setFeedback({
        variant: "warning",
        title: "Unsaved Recitation changes",
        messages: [
          "Save Recitation or cancel changes before switching the manual date.",
        ],
      });
      setLiveMessage(
        "Date switch blocked because the selected Recitation date has unsaved changes.",
      );
      return;
    }

    const dateMonth = date.slice(0, 7);
    if (
      hasQueuedDates &&
      isRecitationDateValue(date) &&
      dateMonth !== monthInput
    ) {
      setFeedback({
        variant: "warning",
        title: "Queued Recitation dates",
        messages: [
          "Add or clear the queued dates before choosing a date from another month.",
        ],
      });
      setLiveMessage(
        "Date change blocked because the queued Recitation dates belong to this month.",
      );
      return;
    }

    setDateInput(date);
    if (isRecitationDateValue(date) && dateMonth !== monthInput) {
      setMonthInput(dateMonth);
      setSessionLoadStatus(selectedClassId ? "loading" : "idle");
      setSessionLoadError("");
      resetSelectedSession();
      setFeedback({
        variant: "info",
        title: "Recitation month changed",
        messages: [
          "The workspace is loading the selected date’s month before creation is available.",
        ],
      });
      setLiveMessage(
        "The Recitation workspace moved to the selected date’s month and is loading it.",
      );
    }
  };

  // Adds the current valid date to the local month queue without writing records.
  const handleQueueDate = () => {
    if (!canQueueDate) {
      return;
    }

    setQueuedDates((currentDates) => [...currentDates, dateInput].sort());
    setDateInput("");
    setFeedback({
      variant: "info",
      title: "Recitation date queued",
      messages: [
        `${formatRecitationDateLong(dateInput)} will be created when Add dates is selected.`,
      ],
    });
    setLiveMessage(
      `${formatRecitationDateLong(dateInput)} added to the Recitation date queue.`,
    );
  };

  // Removes one unsaved date from the local queue.
  const handleRemoveQueuedDate = (date: string) => {
    if (isBusy) {
      return;
    }

    setQueuedDates((currentDates) =>
      currentDates.filter((queuedDate) => queuedDate !== date),
    );
    setFeedback(null);
    setLiveMessage(
      `${formatRecitationDateLong(date)} removed from the Recitation date queue.`,
    );
  };

  // Clears only locally queued dates and leaves persisted sessions unchanged.
  const handleClearQueuedDates = () => {
    if (isBusy || queuedDates.length === 0) {
      return;
    }

    setQueuedDates([]);
    setFeedback(null);
    setLiveMessage(
      "Queued Recitation dates cleared. No saved dates were changed.",
    );
  };

  // Creates each requested manual date, then reconciles any concurrent duplicates once.
  const handleAddDates = async () => {
    if (!selectedClass || pendingDates.length === 0) {
      setFeedback({
        variant: "error",
        title: "Recitation date required",
        messages: [
          "Choose an active class and at least one valid calendar date.",
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
      pendingDates.some((date) => date.slice(0, 7) !== monthInput)
    ) {
      setFeedback({
        variant: "error",
        title: "One calendar month required",
        messages: [
          "Queue Recitation dates from the currently selected month only.",
        ],
      });
      setLiveMessage(
        "Recitation dates were not added because their month did not match.",
      );
      return;
    }

    const requestedDates = [...pendingDates];
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
            (message) => `${formatRecitationDateLong(sessionDate)}: ${message}`,
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
      setQueuedDates((currentDates) =>
        currentDates.filter((queuedDate) => !completedDates.has(queuedDate)),
      );
      if (completedDates.has(dateInput)) {
        setDateInput("");
      }

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
          `${remainingDates.length} ${remainingDates.length === 1 ? "date remains" : "dates remain"} queued for another attempt.`,
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
          ? `${completedDates.size} Recitation dates are available; ${remainingDates.length} remain queued.`
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
      `${formatRecitationDateLong(nextSession.sessionDate)} selected in read-only mode.`,
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
      `${formatRecitationDateLong(selectedSessionDraft.sessionDate)} is now editable.`,
    );
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
        `${formatRecitationDateLong(savedSession.sessionDate)} Recitation saved.`,
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
    dateInput,
    queuedDates,
    pendingDateCount: pendingDates.length,
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
    canQueueDate,
    canAddDates,
    dateHint,
    feedback,
    liveMessage,
    handleRetryLoad,
    handleClassChange,
    handleMonthChange,
    handleDateInputChange,
    handleQueueDate,
    handleRemoveQueuedDate,
    handleClearQueuedDates,
    handleAddDates,
    handleRetrySessionLoad,
    handleSelectSession,
    handleEdit,
    handleCycleMark,
    handleUndo,
    handleCancel,
    handleSave,
  };
}
