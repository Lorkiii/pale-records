// Owns credentialed class requests and validates their public response shapes.
import type {
  ClassRecord,
  ClassScheduleRecord,
  CreateClassInput,
} from './class-types';

const CLASS_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

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

// Verifies one untrusted weekly schedule before it reaches the Class UI.
function isClassScheduleRecord(value: unknown): value is ClassScheduleRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.dayOfWeek === 'number' &&
    Number.isInteger(value.dayOfWeek) &&
    value.dayOfWeek >= 1 &&
    value.dayOfWeek <= 7 &&
    typeof value.startTime === 'string' &&
    CLASS_TIME_PATTERN.test(value.startTime) &&
    typeof value.endTime === 'string' &&
    CLASS_TIME_PATTERN.test(value.endTime) &&
    value.endTime > value.startTime
  );
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
    isNullableString(value.endDate) &&
    Array.isArray(value.schedules) &&
    value.schedules.every(isClassScheduleRecord)
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

// Selects and validates the class collection from a successful response's data object.
function readClasses(data: Record<string, unknown>) {
  if (!Array.isArray(data.classes) || !data.classes.every(isClassRecord)) {
    return undefined;
  }

  return data.classes;
}

// Selects and validates the class record shared by create and update responses.
function readClass(data: Record<string, unknown>) {
  return isClassRecord(data.class) ? data.class : undefined;
}

// Selects the archived class identifier confirmed by the server.
function readArchivedClassId(data: Record<string, unknown>) {
  return typeof data.classId === 'string' ? data.classId : undefined;
}

// Parses the shared success envelope and delegates endpoint-specific data validation.
async function readSuccessData<Result>(
  response: Response,
  errorMessage: string,
  readData: (data: Record<string, unknown>) => Result | undefined,
) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ClassApiError(errorMessage, response.status);
  }

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new ClassApiError(errorMessage, response.status);
  }

  const result = readData(payload.data);

  if (result === undefined) {
    throw new ClassApiError(errorMessage, response.status);
  }

  return result;
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

  return readSuccessData(response, 'Unable to read the class directory.', readClasses);
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

  return readSuccessData(response, 'Unable to read the created class.', readClass);
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

  return readSuccessData(response, 'Unable to read the updated class.', readClass);
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

  return readSuccessData(response, 'Unable to confirm the archived class.', readArchivedClassId);
}
