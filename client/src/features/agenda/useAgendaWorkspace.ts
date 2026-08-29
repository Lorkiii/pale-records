// Owns Agenda workspace state, calendar navigation, local persistence, and synced class projections.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClassRecord } from '../classes/class-types';
import { fetchClasses, ClassApiError } from '../classes/classes-api';
import type {
  AgendaEvent,
  AgendaTypeFilter,
  CreateAgendaEventInput,
  SyncedClassSession,
  UpdateAgendaEventInput,
} from './agenda-types';
import { generateEventId, loadPersistedEvents, savePersistedEvents } from './agenda-storage';
import {
  buildMonthMatrix,
  formatDateKey,
  projectClassSchedulesForMonth,
} from './agenda-utils';

export interface AgendaFeedback {
  variant: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export function useAgendaWorkspace(onSessionExpired?: () => void) {
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(new Date()));

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classLoadStatus, setClassLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [events, setEvents] = useState<AgendaEvent[]>(() => loadPersistedEvents());

  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<AgendaTypeFilter>('ALL');
  const [feedback, setFeedback] = useState<AgendaFeedback | null>(null);

  // Auto-clear feedback after 5 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Fetches live classes to derive recurring schedules
  useEffect(() => {
    const controller = new AbortController();

    fetchClasses(controller.signal)
      .then((loadedClasses) => {
        setClasses(loadedClasses);
        setClassLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (error instanceof ClassApiError && error.status === 401) {
          onSessionExpired?.();
          return;
        }

        setClassLoadStatus('error');
      });

    return () => controller.abort();
  }, [onSessionExpired]);

  // Saves events to storage whenever the event list updates
  const updateEventsAndPersist = useCallback((updater: (prev: AgendaEvent[]) => AgendaEvent[]) => {
    setEvents((prev) => {
      const next = updater(prev);
      savePersistedEvents(next);
      return next;
    });
  }, []);

  // Filtered classes based on selectedClassId
  const activeClasses = useMemo(() => {
    if (selectedClassId === 'ALL') return classes;
    return classes.filter((c) => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  // Projects class schedules for the currently displayed month
  const projectedSessionsMap = useMemo(() => {
    if (selectedTypeFilter === 'CUSTOM_EVENTS') {
      return new Map<string, SyncedClassSession[]>();
    }
    return projectClassSchedulesForMonth(activeClasses, viewYear, viewMonth);
  }, [activeClasses, viewYear, viewMonth, selectedTypeFilter]);

  // Groups and filters custom events by date
  const eventsByDateMap = useMemo(() => {
    if (selectedTypeFilter === 'CLASS_SESSIONS') {
      return new Map<string, AgendaEvent[]>();
    }

    const map = new Map<string, AgendaEvent[]>();

    for (const evt of events) {
      // Filter by class if selected
      if (selectedClassId !== 'ALL') {
        if (evt.classId !== selectedClassId) continue;
      }

      // Filter by specific event type
      if (
        selectedTypeFilter !== 'ALL' &&
        selectedTypeFilter !== 'CUSTOM_EVENTS' &&
        evt.eventType !== selectedTypeFilter
      ) {
        continue;
      }

      const existing = map.get(evt.eventDate) || [];
      existing.push(evt);
      map.set(evt.eventDate, existing);
    }

    // Sort events within each date
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        const timeA = a.startTime || '00:00';
        const timeB = b.startTime || '00:00';
        return timeA.localeCompare(timeB);
      });
      map.set(key, list);
    }

    return map;
  }, [events, selectedClassId, selectedTypeFilter]);

  // Builds the calendar day cells for the current view
  const calendarCells = useMemo(() => {
    return buildMonthMatrix(
      viewYear,
      viewMonth,
      selectedDateKey,
      eventsByDateMap,
      projectedSessionsMap,
    );
  }, [viewYear, viewMonth, selectedDateKey, eventsByDateMap, projectedSessionsMap]);

  // Selected date's events and sessions
  const selectedDateEvents = useMemo(() => {
    return eventsByDateMap.get(selectedDateKey) || [];
  }, [eventsByDateMap, selectedDateKey]);

  const selectedDateSessions = useMemo(() => {
    return projectedSessionsMap.get(selectedDateKey) || [];
  }, [projectedSessionsMap, selectedDateKey]);

  // Calendar Navigation Handlers
  const goToNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDateKey(formatDateKey(today));
  }, []);

  const selectDate = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
    const [y, m] = dateKey.split('-').map(Number);
    if (y !== viewYear || m - 1 !== viewMonth) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [viewYear, viewMonth]);

  // Event Mutations
  const createEvent = useCallback((input: CreateAgendaEventInput) => {
    const timestamp = new Date().toISOString();
    const newEvent: AgendaEvent = {
      id: generateEventId(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      eventDate: input.eventDate,
      startTime: input.isAllDay ? null : input.startTime || null,
      endTime: input.isAllDay ? null : input.endTime || null,
      isAllDay: input.isAllDay,
      eventType: input.eventType,
      classId: input.classId || null,
      location: input.location?.trim() || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    updateEventsAndPersist((prev) => [newEvent, ...prev]);
    setSelectedDateKey(newEvent.eventDate);

    setFeedback({
      variant: 'success',
      title: 'Event Scheduled',
      message: `"${newEvent.title}" was saved to your agenda.`,
    });

    return newEvent;
  }, [updateEventsAndPersist]);

  const updateEvent = useCallback((id: string, input: UpdateAgendaEventInput) => {
    let updatedTitle = '';

    updateEventsAndPersist((prev) =>
      prev.map((evt) => {
        if (evt.id !== id) return evt;
        updatedTitle = input.title.trim();
        return {
          ...evt,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          eventDate: input.eventDate,
          startTime: input.isAllDay ? null : input.startTime || null,
          endTime: input.isAllDay ? null : input.endTime || null,
          isAllDay: input.isAllDay,
          eventType: input.eventType,
          classId: input.classId || null,
          location: input.location?.trim() || null,
          updatedAt: new Date().toISOString(),
        };
      }),
    );

    setFeedback({
      variant: 'success',
      title: 'Event Updated',
      message: `"${updatedTitle}" changes were saved.`,
    });
  }, [updateEventsAndPersist]);

  const deleteEvent = useCallback((id: string) => {
    let removedTitle = '';
    updateEventsAndPersist((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) removedTitle = target.title;
      return prev.filter((e) => e.id !== id);
    });

    setFeedback({
      variant: 'info',
      title: 'Event Removed',
      message: removedTitle ? `"${removedTitle}" was removed.` : 'Event was removed.',
    });
  }, [updateEventsAndPersist]);

  return {
    viewYear,
    viewMonth,
    selectedDateKey,
    classes,
    classLoadStatus,
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
    createEvent,
    updateEvent,
    deleteEvent,
    dismissFeedback: () => setFeedback(null),
  };
}
