// Owns credentialed class requests and validates their public response shapes.
import type { ClassRecord, CreateClassInput } from './class-types';

interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
}

// Carries HTTP and field-validation context from a failed class request.
export class ClassApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;

  // Builds a consistent error that class screens can handle without parsing responses again.
  constructor(message: string, status: number, details?: ErrorDetails) {
    super(message);
    this.name = 'ClassApiError';
    this.status = status;
    this.fieldErrors = details?.fieldErrors ?? {};
  }
}

// Narrows untrusted JSON to an object before any properties are read from it.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Accepts the nullable string shape used by optional class response fields.
function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

// Verifies that an untrusted value matches the complete public class record shape.
function isClassRecord(value: unknown): value is ClassRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.subjectName === 'string' &&
    isNullableString(value.subjectCode) &&
    isNullableString(value.section) &&
    isNullableString(value.schoolYear) &&
    isNullableString(value.semester) &&
    isNullableString(value.teacher) &&
    isNullableString(value.room) &&
    isNullableString(value.startDate) &&
    isNullableString(value.endDate)
  );
}

// Keeps only server field errors that the class form can safely display.
function readFieldErrors(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((message) => typeof message === 'string'),
  );

  return Object.fromEntries(entries);
}

// Converts an unsuccessful HTTP response into the shared class API error type.
async function readApiError(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return new ClassApiError('Unable to complete the class request.', response.status);
  }

  if (!isRecord(payload) || !isRecord(payload.error)) {
    return new ClassApiError('Unable to complete the class request.', response.status);
  }

  const message = typeof payload.error.message === 'string'
    ? payload.error.message
    : 'Unable to complete the class request.';
  const details = isRecord(payload.error.details)
    ? { fieldErrors: readFieldErrors(payload.error.details.fieldErrors) }
    : undefined;

  return new ClassApiError(message, response.status, details);
}

// Reads successful JSON while preserving a request-specific fallback message.
async function readSuccessPayload(response: Response, errorMessage: string) {
  try {
    return await response.json() as unknown;
  } catch {
    throw new ClassApiError(errorMessage, response.status);
  }
}

// Loads the active class directory and validates every returned record.
export async function fetchClasses(signal: AbortSignal) {
  let response: Response;

  try {
    response = await fetch('/api/classes', {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ClassApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }
  // Reads the successful JSON payload and validates it against the expected shape.
  const payload = await readSuccessPayload(response, 'Unable to read the class directory.');

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !Array.isArray(payload.data.classes) ||
    !payload.data.classes.every(isClassRecord)
  ) {
    throw new ClassApiError('Unable to read the class directory.', response.status);
  }

  return payload.data.classes;
}

// Persists a new class and returns the validated record created by the server.
export async function createClass(input: CreateClassInput) {
  let response: Response;

  try {
    response = await fetch('/api/classes', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ClassApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = await readSuccessPayload(response, 'Unable to read the created class.');

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !isClassRecord(payload.data.class)
  ) {
    throw new ClassApiError('Unable to read the created class.', response.status);
  }

  return payload.data.class;
}

// Replaces the editable fields of an active class and returns its validated record.
export async function updateClass(classId: string, input: CreateClassInput) {
  let response: Response;

  try {
    response = await fetch(`/api/classes/${encodeURIComponent(classId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ClassApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = await readSuccessPayload(response, 'Unable to read the updated class.');

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !isClassRecord(payload.data.class)
  ) {
    throw new ClassApiError('Unable to read the updated class.', response.status);
  }

  return payload.data.class;
}

// Soft-archives an active class and returns the identifier confirmed by the server.
export async function archiveClass(classId: string) {
  let response: Response;

  try {
    response = await fetch(`/api/classes/${encodeURIComponent(classId)}/archive`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    throw new ClassApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = await readSuccessPayload(response, 'Unable to confirm the archived class.');

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    typeof payload.data.classId !== 'string'
  ) {
    throw new ClassApiError('Unable to confirm the archived class.', response.status);
  }

  return payload.data.classId;
}
