// Persists and validates local Agenda events in browser storage.
import type { AgendaEvent, AgendaEventType } from './agenda-types';

const STORAGE_KEY = 'pale_agenda_events_v1';

const VALID_EVENT_TYPES: Set<AgendaEventType> = new Set([
  'EXAM',
  'ASSIGNMENT',
  'ACTIVITY',
  'HOLIDAY',
  'MEETING',
  'NOTE',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidAgendaEvent(item: unknown): item is AgendaEvent {
  if (!isRecord(item)) return false;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.eventDate === 'string' &&
    typeof item.isAllDay === 'boolean' &&
    typeof item.eventType === 'string' &&
    VALID_EVENT_TYPES.has(item.eventType as AgendaEventType) &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  );
}

// Reads and safely validates stored events from localStorage.
export function loadPersistedEvents(): AgendaEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidAgendaEvent);
  } catch {
    return [];
  }
}

// Persists updated events back to browser storage.
export function savePersistedEvents(events: AgendaEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Storage quota or browser restriction silently ignored.
  }
}

// Generates a unique client-side identifier for new agenda records.
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
