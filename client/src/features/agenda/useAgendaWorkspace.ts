// Owns Agenda categories/events, navigation, filters, projections, and confirmed writes.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClassRecord } from '../classes/class-types';
import { fetchClasses, ClassApiError } from '../classes/classes-api';
import {
  AgendaApiError,
  completeAgendaEvent,
  createAgendaEvent,
  deleteAgendaEvent,
  listAgendaEvents,
  reopenAgendaEvent,
  updateAgendaEvent,
} from './agenda-api';
import { fetchAgendaCategories } from './agenda-category-api';
import type {
  AgendaCategory,
  AgendaEvent,
  AgendaTypeFilter,
  CreateAgendaEventInput,
  SyncedClassSession,
  UpdateAgendaEventInput,
} from './agenda-types';
import {
  buildMonthMatrix,
  formatDateKey,
  getVisibleAgendaRange,
  projectClassSchedulesForMonth,
} from './agenda-utils';

type LoadStatus = 'loading' | 'ready' | 'error';

export interface AgendaFeedback {
  variant: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

// Replaces one confirmed server event or adds it when it is newly created.
function replaceAgendaEvent(events: AgendaEvent[], nextEvent: AgendaEvent) {
  const remainingEvents = events.filter((event) => event.id !== nextEvent.id);
  return [nextEvent, ...remainingEvents];
}

// Detects an intentionally canceled fetch without surfacing a user-facing error.
function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useAgendaWorkspace(onSessionExpired?: () => void) {
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(new Date()));

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classLoadStatus, setClassLoadStatus] = useState<LoadStatus>('loading');
  const [classLoadError, setClassLoadError] = useState('');
  const [classLoadAttempt, setClassLoadAttempt] = useState(0);

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [eventLoadStatus, setEventLoadStatus] = useState<LoadStatus>('loading');
  const [eventLoadError, setEventLoadError] = useState('');
  const [eventLoadAttempt, setEventLoadAttempt] = useState(0);

  const [categories, setCategories] = useState<AgendaCategory[]>([]);
  const [categoryLoadStatus, setCategoryLoadStatus] = useState<LoadStatus>('loading');
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const [categoryLoadAttempt, setCategoryLoadAttempt] = useState(0);

  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<AgendaTypeFilter>('ALL');
  const [feedback, setFeedback] = useState<AgendaFeedback | null>(null);

  // Keeps normal confirmed mutation feedback visible for five seconds.
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  // Loads Classes independently so failures never block general Agenda events.
  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    fetchClasses(controller.signal)
      .then((loadedClasses) => {
        if (!isCurrentRequest) return;
        setClasses(loadedClasses);
        setClassLoadError('');
        setClassLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || !isCurrentRequest) return;

        if (error instanceof ClassApiError && error.status === 401) {
          onSessionExpired?.();
          return;
        }

        setClassLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load Classes for Agenda associations and recurring schedules.',
        );
        setSelectedClassId('ALL');
        setClassLoadStatus('error');
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [classLoadAttempt, onSessionExpired]);

  // Loads the exact visible 35- or 42-cell range and ignores obsolete month responses.
  useEffect(() => {
    const controller = new AbortController();
    const range = getVisibleAgendaRange(viewYear, viewMonth);
    let isCurrentRequest = true;

    listAgendaEvents(range.from, range.to, controller.signal)
      .then((loadedEvents) => {
        if (!isCurrentRequest) return;
        setEvents(loadedEvents);
        setEventLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || !isCurrentRequest) return;

        if (error instanceof AgendaApiError && error.status === 401) {
          onSessionExpired?.();
          return;
        }

        setEventLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load Agenda events for this calendar range.',
        );
        setEventLoadStatus('error');
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [eventLoadAttempt, onSessionExpired, viewMonth, viewYear]);

  // Loads all owned categories so inactive event categories remain readable and filterable.
  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    fetchAgendaCategories(controller.signal)
      .then((loadedCategories) => {
        if (!isCurrentRequest) return;
        setCategories(loadedCategories);
        setCategoryLoadError('');
        setCategoryLoadStatus('ready');
        setSelectedTypeFilter((currentFilter) => {
          if (currentFilter === 'ALL' || currentFilter === 'CUSTOM_EVENTS' ||
              currentFilter === 'CLASS_SESSIONS') return currentFilter;
          return loadedCategories.some((category) => category.id === currentFilter)
            ? currentFilter
            : 'ALL';
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || !isCurrentRequest) return;
        if (error instanceof AgendaApiError && error.status === 401) {
          onSessionExpired?.();
          return;
        }
        setCategoryLoadError(
          error instanceof Error ? error.message : 'Unable to load Agenda categories.',
        );
        setCategoryLoadStatus('error');
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [categoryLoadAttempt, onSessionExpired]);

  const availableClasses = useMemo(
    () => classLoadStatus === 'ready' ? classes : [],
    [classLoadStatus, classes],
  );

  const activeClasses = useMemo(() => {
    if (selectedClassId === 'ALL') return availableClasses;
    return availableClasses.filter((classRecord) => classRecord.id === selectedClassId);
  }, [availableClasses, selectedClassId]);

  // Preserves the existing recurring Class projection without coupling it to event loading.
  const projectedSessionsMap = useMemo(() => {
    if (selectedTypeFilter === 'CUSTOM_EVENTS') {
      return new Map<string, SyncedClassSession[]>();
    }
    return projectClassSchedulesForMonth(activeClasses, viewYear, viewMonth);
  }, [activeClasses, viewYear, viewMonth, selectedTypeFilter]);

  // Groups the current server range using the existing filters and event ordering.
  const eventsByDateMap = useMemo(() => {
    if (selectedTypeFilter === 'CLASS_SESSIONS') {
      return new Map<string, AgendaEvent[]>();
    }

    const map = new Map<string, AgendaEvent[]>();

    for (const event of events) {
      if (selectedClassId !== 'ALL' && event.classId !== selectedClassId) {
        continue;
      }

      if (
        selectedTypeFilter !== 'ALL' &&
        selectedTypeFilter !== 'CUSTOM_EVENTS' &&
        event.categoryId !== selectedTypeFilter
      ) {
        continue;
      }

      const existing = map.get(event.eventDate) ?? [];
      existing.push(event);
      map.set(event.eventDate, existing);
    }

    for (const [dateKey, dateEvents] of map.entries()) {
      dateEvents.sort((first, second) => {
        if (first.isAllDay && !second.isAllDay) return -1;
        if (!first.isAllDay && second.isAllDay) return 1;
        return (first.startTime ?? '00:00').localeCompare(second.startTime ?? '00:00');
      });
      map.set(dateKey, dateEvents);
    }

    return map;
  }, [events, selectedClassId, selectedTypeFilter]);

  const calendarCells = useMemo(() => buildMonthMatrix(
    viewYear,
    viewMonth,
    selectedDateKey,
    eventsByDateMap,
    projectedSessionsMap,
  ), [viewYear, viewMonth, selectedDateKey, eventsByDateMap, projectedSessionsMap]);

  const selectedDateEvents = useMemo(
    () => eventsByDateMap.get(selectedDateKey) ?? [],
    [eventsByDateMap, selectedDateKey],
  );

  const selectedDateSessions = useMemo(
    () => projectedSessionsMap.get(selectedDateKey) ?? [],
    [projectedSessionsMap, selectedDateKey],
  );

  // Moves one month while clamping the selected day into the destination month.
  const moveDisplayedMonth = useCallback((monthOffset: number) => {
    const destination = new Date(viewYear, viewMonth + monthOffset, 1);
    const selectedDay = Number(selectedDateKey.split('-')[2]) || 1;
    const destinationLastDay = new Date(
      destination.getFullYear(),
      destination.getMonth() + 1,
      0,
    ).getDate();
    const clampedDate = new Date(
      destination.getFullYear(),
      destination.getMonth(),
      Math.min(selectedDay, destinationLastDay),
    );

    setEventLoadStatus('loading');
    setEventLoadError('');
    setViewYear(destination.getFullYear());
    setViewMonth(destination.getMonth());
    setSelectedDateKey(formatDateKey(clampedDate));
  }, [selectedDateKey, viewMonth, viewYear]);

  const goToNextMonth = useCallback(() => moveDisplayedMonth(1), [moveDisplayedMonth]);
  const goToPrevMonth = useCallback(() => moveDisplayedMonth(-1), [moveDisplayedMonth]);

  const goToToday = useCallback(() => {
    const today = new Date();
    if (today.getFullYear() !== viewYear || today.getMonth() !== viewMonth) {
      setEventLoadStatus('loading');
      setEventLoadError('');
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDateKey(formatDateKey(today));
  }, [viewMonth, viewYear]);

  const selectDate = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
    const [year, month] = dateKey.split('-').map(Number);
    if (year !== viewYear || month - 1 !== viewMonth) {
      setEventLoadStatus('loading');
      setEventLoadError('');
      setViewYear(year);
      setViewMonth(month - 1);
    }
  }, [viewYear, viewMonth]);

  // Keeps selection and display aligned with a confirmed server event date.
  const selectEventDate = useCallback((dateKey: string) => {
    const [year, month] = dateKey.split('-').map(Number);
    setSelectedDateKey(dateKey);
    if (year !== viewYear || month - 1 !== viewMonth) {
      setEventLoadStatus('loading');
      setEventLoadError('');
      setViewYear(year);
      setViewMonth(month - 1);
    }
  }, [viewMonth, viewYear]);

  const retryEventLoad = useCallback(() => {
    setEventLoadStatus('loading');
    setEventLoadError('');
    setEventLoadAttempt((attempt) => attempt + 1);
  }, []);

  const retryClassLoad = useCallback(() => {
    setClassLoadStatus('loading');
    setClassLoadError('');
    setSelectedClassId('ALL');
    setClassLoadAttempt((attempt) => attempt + 1);
  }, []);

  const retryCategoryLoad = useCallback(() => {
    setCategoryLoadStatus('loading');
    setCategoryLoadError('');
    setCategoryLoadAttempt((attempt) => attempt + 1);
  }, []);

  // Creates only after the server confirms the canonical UUID and timestamps.
  const createEvent = useCallback(async (input: CreateAgendaEventInput) => {
    try {
      const createdEvent = await createAgendaEvent(input);
      setEvents((currentEvents) => replaceAgendaEvent(currentEvents, createdEvent));
      selectEventDate(createdEvent.eventDate);
      setFeedback({
        variant: 'success',
        title: 'Event Scheduled',
        message: `"${createdEvent.title}" was saved to your Agenda.`,
      });
      return createdEvent;
    } catch (error: unknown) {
      if (error instanceof AgendaApiError && error.status === 401) {
        onSessionExpired?.();
      }
      throw error;
    }
  }, [onSessionExpired, selectEventDate]);

  // Replaces only the confirmed server event and follows any returned date change.
  const updateEvent = useCallback(async (
    eventId: string,
    input: UpdateAgendaEventInput,
  ) => {
    try {
      const updatedEvent = await updateAgendaEvent(eventId, input);
      setEvents((currentEvents) => replaceAgendaEvent(currentEvents, updatedEvent));
      selectEventDate(updatedEvent.eventDate);
      setFeedback({
        variant: 'success',
        title: 'Event Updated',
        message: `"${updatedEvent.title}" changes were saved.`,
      });
      return updatedEvent;
    } catch (error: unknown) {
      if (error instanceof AgendaApiError && error.status === 401) {
        onSessionExpired?.();
      }
      throw error;
    }
  }, [onSessionExpired, selectEventDate]);

  // Removes an event only after the API confirms the exact requested UUID.
  const deleteEvent = useCallback(async (eventId: string) => {
    const eventTitle = events.find((event) => event.id === eventId)?.title;

    try {
      const deletedEventId = await deleteAgendaEvent(eventId);
      if (deletedEventId !== eventId) {
        throw new AgendaApiError(
          'The deleted Agenda event did not match the request.',
          200,
        );
      }

      setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
      setFeedback({
        variant: 'info',
        title: 'Event Removed',
        message: eventTitle ? `"${eventTitle}" was removed.` : 'Event was removed.',
      });
    } catch (error: unknown) {
      if (error instanceof AgendaApiError && error.status === 401) {
        onSessionExpired?.();
      }
      throw error;
    }
  }, [events, onSessionExpired]);

  const setEventCompletion = useCallback(async (event: AgendaEvent) => {
    try {
      const updatedEvent = event.completedAt
        ? await reopenAgendaEvent(event.id)
        : await completeAgendaEvent(event.id);
      setEvents((currentEvents) => replaceAgendaEvent(currentEvents, updatedEvent));
      setFeedback({
        variant: 'success',
        title: updatedEvent.completedAt ? 'Event Completed' : 'Event Reopened',
        message: updatedEvent.completedAt
          ? `“${updatedEvent.title}” is marked complete.`
          : `“${updatedEvent.title}” is active again.`,
      });
      return updatedEvent;
    } catch (error: unknown) {
      if (error instanceof AgendaApiError && error.status === 401) {
        onSessionExpired?.();
      }
      throw error;
    }
  }, [onSessionExpired]);

  return {
    viewYear,
    viewMonth,
    selectedDateKey,
    classes: availableClasses,
    classLoadStatus,
    classLoadError,
    eventLoadStatus,
    eventLoadError,
    categories,
    categoryLoadStatus,
    categoryLoadError,
    canManageEvents: eventLoadStatus === 'ready' &&
      categoryLoadStatus === 'ready' &&
      categories.some((category) => category.isActive),
    events,
    selectedClassId,
    selectedTypeFilter,
    feedback,
    calendarCells,
    selectedDateEvents,
    selectedDateSessions,
    setSelectedClassId,
    setSelectedTypeFilter,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    selectDate,
    retryEventLoad,
    retryClassLoad,
    retryCategoryLoad,
    createEvent,
    updateEvent,
    deleteEvent,
    setEventCompletion,
    dismissFeedback: () => setFeedback(null),
  };
}
