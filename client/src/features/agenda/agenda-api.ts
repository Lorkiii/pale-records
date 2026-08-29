// Owns credentialed Agenda requests, exact response parsing, and safe API errors.
import type {
  AgendaEvent,
  AgendaEventType,
  AgendaLegacyImportAcknowledgement,
  CreateAgendaEventInput,
  LegacyAgendaEventInput,
  UpdateAgendaEventInput,
} from './agenda-types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_AGENDA_EVENTS = 500;
const MAX_AGENDA_RANGE_DAYS = 62;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type AgendaApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'AGENDA_EVENT_NOT_FOUND'
  | 'AGENDA_CLASS_NOT_FOUND'
  | 'MALFORMED_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_SERVER_ERROR'
  | 'AGENDA_CLIENT_INPUT_INVALID'
  | 'AGENDA_REQUEST_FAILED';

interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

interface AgendaEventPayload {
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  eventType: AgendaEventType;
  classId: string | null;
  location: string | null;
}

// Carries only safe HTTP, product-code, and validation details to Agenda UI state.
export class AgendaApiError extends Error {
  status: number;
  code: AgendaApiErrorCode;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];

  constructor(
    message: string,
    status: number,
    code: AgendaApiErrorCode = 'AGENDA_REQUEST_FAILED',
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AgendaApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors ?? {};
    this.formErrors = details?.formErrors ?? [];
  }
}

// Narrows untrusted JSON to a property container before reading any value.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Enforces exact keys so internal or additional server fields never enter page state.
function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).toSorted();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
}

// Validates a real date-only value without converting through browser local time.
function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Returns stable UTC milliseconds only after a date-only string passes validation.
function getDateOnlyUtcTime(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

// Narrows the six public Agenda categories without trusting a type assertion.
function isAgendaEventType(value: unknown): value is AgendaEventType {
  return value === 'EXAM' ||
    value === 'ASSIGNMENT' ||
    value === 'ACTIVITY' ||
    value === 'HOLIDAY' ||
    value === 'MEETING' ||
    value === 'NOTE';
}

// Accepts only the known safe error codes published by the Agenda API.
function isAgendaApiErrorCode(value: unknown): value is AgendaApiErrorCode {
  return value === 'VALIDATION_ERROR' ||
    value === 'UNAUTHENTICATED' ||
    value === 'AGENDA_EVENT_NOT_FOUND' ||
    value === 'AGENDA_CLASS_NOT_FOUND' ||
    value === 'MALFORMED_JSON' ||
    value === 'PAYLOAD_TOO_LARGE' ||
    value === 'INTERNAL_SERVER_ERROR';
}

// Validates the exact public Agenda event record and its time invariants.
function isAgendaEvent(value: unknown): value is AgendaEvent {
  if (!isRecord(value) || !hasExactKeys(value, [
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
  ])) {
    return false;
  }

  const startTime = value.startTime;
  const endTime = value.endTime;
  const hasValidTimes = (startTime === null ||
    typeof startTime === 'string' && TIME_PATTERN.test(startTime)) &&
    (endTime === null ||
      typeof endTime === 'string' && TIME_PATTERN.test(endTime));
  const hasValidOptionalText = (value.description === null ||
    typeof value.description === 'string' && value.description.length <= 2000) &&
    (value.location === null ||
      typeof value.location === 'string' && value.location.length <= 160);

  if (
    typeof value.id !== 'string' || !UUID_PATTERN.test(value.id) ||
    typeof value.title !== 'string' ||
    value.title.trim().length < 1 ||
    value.title.length > 160 ||
    !hasValidOptionalText ||
    !isDateOnly(value.eventDate) ||
    !hasValidTimes ||
    typeof value.isAllDay !== 'boolean' ||
    !isAgendaEventType(value.eventType) ||
    !(value.classId === null ||
      typeof value.classId === 'string' && UUID_PATTERN.test(value.classId)) ||
    typeof value.createdAt !== 'string' ||
    !ISO_TIMESTAMP_PATTERN.test(value.createdAt) ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== 'string' ||
    !ISO_TIMESTAMP_PATTERN.test(value.updatedAt) ||
    Number.isNaN(Date.parse(value.updatedAt))
  ) {
    return false;
  }

  if (value.isAllDay && (startTime !== null || endTime !== null)) {
    return false;
  }

  return startTime === null || endTime === null || endTime > startTime;
}

// Keeps only complete string-array field error entries from validation responses.
function readFieldErrors(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) &&
      entry[1].every((message) => typeof message === 'string'),
  );
  return entries.length === Object.keys(value).length
    ? Object.fromEntries(entries)
    : undefined;
}

// Reads exact optional validation details without accepting internal fields.
function readErrorDetails(value: unknown): ErrorDetails | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ['fieldErrors', 'formErrors'])) {
    return undefined;
  }

  const fieldErrors = readFieldErrors(value.fieldErrors);
  const formErrors = Array.isArray(value.formErrors) &&
    value.formErrors.every((message) => typeof message === 'string')
    ? value.formErrors
    : undefined;

  return fieldErrors && formErrors ? { fieldErrors, formErrors } : undefined;
}

// Converts an unsuccessful exact envelope into a safe feature error.
async function readApiError(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return new AgendaApiError('Unable to complete the Agenda request.', response.status);
  }

  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'error']) ||
    payload.success !== false ||
    !isRecord(payload.error)
  ) {
    return new AgendaApiError('Unable to complete the Agenda request.', response.status);
  }

  const errorKeys = Object.hasOwn(payload.error, 'details')
    ? ['code', 'message', 'details']
    : ['code', 'message'];
  if (
    !hasExactKeys(payload.error, errorKeys) ||
    !isAgendaApiErrorCode(payload.error.code) ||
    typeof payload.error.message !== 'string'
  ) {
    return new AgendaApiError('Unable to complete the Agenda request.', response.status);
  }

  const details = Object.hasOwn(payload.error, 'details')
    ? readErrorDetails(payload.error.details)
    : undefined;
  if (Object.hasOwn(payload.error, 'details') && !details) {
    return new AgendaApiError('Unable to complete the Agenda request.', response.status);
  }

  return new AgendaApiError(
    payload.error.message,
    response.status,
    payload.error.code,
    details,
  );
}

// Parses an exact success envelope before endpoint-specific data selection.
async function readSuccessData<Result>(
  response: Response,
  errorMessage: string,
  readData: (data: Record<string, unknown>) => Result | undefined,
) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new AgendaApiError(errorMessage, response.status);
  }

  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true ||
    !isRecord(payload.data)
  ) {
    throw new AgendaApiError(errorMessage, response.status);
  }

  const result = readData(payload.data);
  if (result === undefined) {
    throw new AgendaApiError(errorMessage, response.status);
  }

  return result;
}

// Selects the exact bounded event collection returned for one visible calendar range.
function readEvents(data: Record<string, unknown>) {
  if (
    !hasExactKeys(data, ['events']) ||
    !Array.isArray(data.events) ||
    data.events.length > MAX_AGENDA_EVENTS ||
    !data.events.every(isAgendaEvent)
  ) {
    return undefined;
  }

  const eventIds = data.events.map((event) => event.id);
  return new Set(eventIds).size === eventIds.length ? data.events : undefined;
}

// Selects one exact event shared by create and update responses.
function readEvent(data: Record<string, unknown>) {
  return hasExactKeys(data, ['event']) && isAgendaEvent(data.event)
    ? data.event
    : undefined;
}

// Selects the exact UUID confirmed by a successful delete response.
function readDeletedEventId(data: Record<string, unknown>) {
  return hasExactKeys(data, ['eventId']) &&
    typeof data.eventId === 'string' &&
    UUID_PATTERN.test(data.eventId)
    ? data.eventId
    : undefined;
}

// Preserves AbortError while converting other network failures to the feature error type.
function handleNetworkError(error: unknown): never {
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw error;
  }

  throw new AgendaApiError('Unable to reach PALE Records.', 0);
}

// Normalizes optional form strings to the database API's explicit null representation.
function toNullableTrimmedString(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

// Builds and validates the complete allowlisted POST/PATCH body.
function buildAgendaEventPayload(
  input: CreateAgendaEventInput | UpdateAgendaEventInput | LegacyAgendaEventInput,
): AgendaEventPayload {
  const title = input.title.trim();
  const description = toNullableTrimmedString(input.description);
  const location = toNullableTrimmedString(input.location);
  const startTime = input.isAllDay ? null : toNullableTrimmedString(input.startTime);
  const endTime = input.isAllDay ? null : toNullableTrimmedString(input.endTime);
  const classId = toNullableTrimmedString(input.classId);
  const fieldErrors: Record<string, string[]> = {};

  if (title.length < 1 || title.length > 160) {
    fieldErrors.title = ['Title is required and must be at most 160 characters.'];
  }
  if (description !== null && description.length > 2000) {
    fieldErrors.description = ['Description must be at most 2000 characters.'];
  }
  if (location !== null && location.length > 160) {
    fieldErrors.location = ['Location must be at most 160 characters.'];
  }
  if (!isDateOnly(input.eventDate)) {
    fieldErrors.eventDate = ['Choose a valid Agenda date.'];
  }
  if (startTime !== null && !TIME_PATTERN.test(startTime)) {
    fieldErrors.startTime = ['Start time must use the HH:MM 24-hour format.'];
  }
  if (endTime !== null && !TIME_PATTERN.test(endTime)) {
    fieldErrors.endTime = ['End time must use the HH:MM 24-hour format.'];
  }
  if (startTime !== null && endTime !== null && endTime <= startTime) {
    fieldErrors.endTime = ['End time must be later than start time.'];
  }
  if (!isAgendaEventType(input.eventType)) {
    fieldErrors.eventType = ['Choose a valid Agenda category.'];
  }
  if (classId !== null && !UUID_PATTERN.test(classId)) {
    fieldErrors.classId = ['Choose a valid associated class.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AgendaApiError(
      'Review the highlighted Agenda fields.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
      { fieldErrors },
    );
  }

  return {
    title,
    description,
    eventDate: input.eventDate,
    startTime,
    endTime,
    isAllDay: input.isAllDay,
    eventType: input.eventType,
    classId,
    location,
  };
}

// Selects an exact import acknowledgement without accepting internal idempotency fields.
function readLegacyImportAcknowledgement(
  data: Record<string, unknown>,
): AgendaLegacyImportAcknowledgement | undefined {
  if (
    !hasExactKeys(data, ['event', 'imported', 'classAssociationRemoved']) ||
    !isAgendaEvent(data.event) ||
    typeof data.imported !== 'boolean' ||
    typeof data.classAssociationRemoved !== 'boolean'
  ) {
    return undefined;
  }

  return {
    event: data.event,
    imported: data.imported,
    classAssociationRemoved: data.classAssociationRemoved,
  };
}

// Loads at most 500 exact events from one validated inclusive visible calendar range.
export async function listAgendaEvents(
  from: string,
  to: string,
  signal: AbortSignal,
) {
  if (!isDateOnly(from) || !isDateOnly(to)) {
    throw new AgendaApiError(
      'Choose a valid Agenda date range.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
    );
  }

  const inclusiveDayCount =
    (getDateOnlyUtcTime(to) - getDateOnlyUtcTime(from)) / MILLISECONDS_PER_DAY + 1;
  if (inclusiveDayCount < 1 || inclusiveDayCount > MAX_AGENDA_RANGE_DAYS) {
    throw new AgendaApiError(
      'Agenda date ranges must span at most 62 days.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `/api/agenda/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {
        credentials: 'include',
        signal,
      },
    );
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const events = await readSuccessData(
    response,
    'Unable to read Agenda events.',
    readEvents,
  );
  if (events.some((event) => event.eventDate < from || event.eventDate > to)) {
    throw new AgendaApiError('The Agenda response did not match the requested range.', response.status);
  }

  return events;
}

// Creates one event from an explicit complete payload and returns the server record.
export async function createAgendaEvent(input: CreateAgendaEventInput) {
  const payload = buildAgendaEventPayload(input);
  let response: Response;

  try {
    response = await fetch('/api/agenda/events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the created Agenda event.', readEvent);
}

// Replaces the complete editable event payload and validates the returned identity.
export async function updateAgendaEvent(
  eventId: string,
  input: UpdateAgendaEventInput,
) {
  if (!UUID_PATTERN.test(eventId)) {
    throw new AgendaApiError(
      'Choose a valid Agenda event to update.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
    );
  }

  const payload = buildAgendaEventPayload(input);
  let response: Response;

  try {
    response = await fetch(`/api/agenda/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const event = await readSuccessData(
    response,
    'Unable to read the updated Agenda event.',
    readEvent,
  );
  if (event.id !== eventId) {
    throw new AgendaApiError('The updated Agenda event did not match the request.', response.status);
  }

  return event;
}

// Deletes one server event and returns its exact confirmed UUID.
export async function deleteAgendaEvent(eventId: string) {
  if (!UUID_PATTERN.test(eventId)) {
    throw new AgendaApiError(
      'Choose a valid Agenda event to delete.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
    );
  }

  let response: Response;

  try {
    response = await fetch(`/api/agenda/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(
    response,
    'Unable to confirm the deleted Agenda event.',
    readDeletedEventId,
  );
}

// Imports one validated browser event through the server-owned idempotency boundary.
export async function importLegacyAgendaEvent(input: LegacyAgendaEventInput) {
  const legacyEventId = input.legacyEventId.trim();
  if (legacyEventId.length < 1 || legacyEventId.length > 160) {
    throw new AgendaApiError(
      'Choose a valid legacy Agenda event to import.',
      400,
      'AGENDA_CLIENT_INPUT_INVALID',
      { fieldErrors: { legacyEventId: ['Legacy event ID must be 1 to 160 characters.'] } },
    );
  }

  const eventPayload = buildAgendaEventPayload(input);
  const payload = {
    legacyEventId,
    title: eventPayload.title,
    description: eventPayload.description,
    eventDate: eventPayload.eventDate,
    startTime: eventPayload.startTime,
    endTime: eventPayload.endTime,
    isAllDay: eventPayload.isAllDay,
    eventType: eventPayload.eventType,
    classId: eventPayload.classId,
    location: eventPayload.location,
  };
  let response: Response;

  try {
    response = await fetch('/api/agenda/events/import', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(
    response,
    'Unable to confirm the imported Agenda event.',
    readLegacyImportAcknowledgement,
  );
}
