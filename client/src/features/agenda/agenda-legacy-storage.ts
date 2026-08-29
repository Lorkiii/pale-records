// Reads and clears the legacy Agenda key solely for explicit authenticated import.
import type { AgendaEventType, LegacyAgendaEventInput } from './agenda-types';

export const LEGACY_AGENDA_STORAGE_KEY = 'pale_agenda_events_v1';
export const MAX_LEGACY_AGENDA_EVENTS = 200;

export type LegacyAgendaReadResult =
  | { status: 'no_data' }
  | { status: 'ready'; events: LegacyAgendaEventInput[] }
  | {
      status: 'invalid';
      reason: 'invalid_json' | 'invalid_shape' | 'invalid_events' | 'too_many';
      detectedCount: number | null;
      invalidCount: number | null;
    }
  | { status: 'unavailable' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const LEGACY_EVENT_KEYS = new Set([
  'id',
  'title',
  'description',
  'eventDate',
  'startTime',
  'endTime',
  'isAllDay',
  'eventType',
  'classId',
  'location',
  'createdAt',
  'updatedAt',
]);

// Narrows parsed legacy JSON to a non-array record.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Confirms the six historical categories without trusting a type assertion.
function isAgendaEventType(value: unknown): value is AgendaEventType {
  return value === 'EXAM' ||
    value === 'ASSIGNMENT' ||
    value === 'ACTIVITY' ||
    value === 'HOLIDAY' ||
    value === 'MEETING' ||
    value === 'NOTE';
}

// Validates a browser calendar date without local-time conversion.
function isRealDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Normalizes historically optional text while rejecting non-string values.
function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || null : undefined;
}

// Normalizes one complete historical record and omits its untrusted old timestamps.
function normalizeLegacyEvent(value: unknown): LegacyAgendaEventInput | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !LEGACY_EVENT_KEYS.has(key))
  ) {
    return null;
  }

  const legacyEventId = typeof value.id === 'string' ? value.id.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const description = normalizeOptionalText(value.description, 2000);
  const location = normalizeOptionalText(value.location, 160);
  const startTime = value.startTime === undefined || value.startTime === null
    ? null
    : value.startTime;
  const endTime = value.endTime === undefined || value.endTime === null
    ? null
    : value.endTime;
  const classId = value.classId === undefined || value.classId === null
    ? null
    : value.classId;

  if (
    legacyEventId.length < 1 || legacyEventId.length > 160 ||
    title.length < 1 || title.length > 160 ||
    description === undefined ||
    location === undefined ||
    !isRealDateOnly(value.eventDate) ||
    !(startTime === null ||
      typeof startTime === 'string' && TIME_PATTERN.test(startTime)) ||
    !(endTime === null ||
      typeof endTime === 'string' && TIME_PATTERN.test(endTime)) ||
    typeof value.isAllDay !== 'boolean' ||
    !isAgendaEventType(value.eventType) ||
    !(classId === null || typeof classId === 'string' && UUID_PATTERN.test(classId)) ||
    !(value.createdAt === undefined || typeof value.createdAt === 'string') ||
    !(value.updatedAt === undefined || typeof value.updatedAt === 'string')
  ) {
    return null;
  }

  if (value.isAllDay && (startTime !== null || endTime !== null)) {
    return null;
  }

  if (startTime !== null && endTime !== null && endTime <= startTime) {
    return null;
  }

  return {
    legacyEventId,
    title,
    description,
    eventDate: value.eventDate,
    startTime,
    endTime,
    isAllDay: value.isAllDay,
    eventType: value.eventType,
    classId,
    location,
  };
}

// Reads and validates the entire legacy collection before any network request starts.
export function readLegacyAgendaEvents(): LegacyAgendaReadResult {
  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(LEGACY_AGENDA_STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }

  if (rawValue === null) return { status: 'no_data' };

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return {
      status: 'invalid',
      reason: 'invalid_json',
      detectedCount: null,
      invalidCount: null,
    };
  }

  if (!Array.isArray(parsedValue)) {
    return {
      status: 'invalid',
      reason: 'invalid_shape',
      detectedCount: null,
      invalidCount: null,
    };
  }

  if (parsedValue.length === 0) return { status: 'no_data' };

  const normalizedEvents: LegacyAgendaEventInput[] = [];
  let invalidCount = 0;

  for (const item of parsedValue) {
    const normalizedEvent = normalizeLegacyEvent(item);
    if (normalizedEvent) {
      normalizedEvents.push(normalizedEvent);
    } else {
      invalidCount += 1;
    }
  }

  const seenIds = new Set<string>();
  for (const event of normalizedEvents) {
    if (seenIds.has(event.legacyEventId)) {
      invalidCount += 1;
    } else {
      seenIds.add(event.legacyEventId);
    }
  }

  if (parsedValue.length > MAX_LEGACY_AGENDA_EVENTS) {
    return {
      status: 'invalid',
      reason: 'too_many',
      detectedCount: parsedValue.length,
      invalidCount,
    };
  }

  if (invalidCount > 0) {
    return {
      status: 'invalid',
      reason: 'invalid_events',
      detectedCount: parsedValue.length,
      invalidCount,
    };
  }

  return { status: 'ready', events: normalizedEvents };
}

// Removes the exact legacy key only after complete server acknowledgement and verifies cleanup.
export function clearLegacyAgendaEvents() {
  try {
    window.localStorage.removeItem(LEGACY_AGENDA_STORAGE_KEY);
    return window.localStorage.getItem(LEGACY_AGENDA_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}
