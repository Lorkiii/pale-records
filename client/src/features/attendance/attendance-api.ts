// Owns credentialed Attendance month, date, and roster requests with runtime response validation.
import {
  ATTENDANCE_REMARKS_MAX_LENGTH,
  type AttendanceRecord,
  type AttendanceSessionRecord,
  type AttendanceStatusCode,
  type AttendanceStudentRecord,
  type SaveAttendanceRecordInput,
} from './attendance-types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

// Carries safe HTTP, product-code, and validation details to Attendance screens.
export class AttendanceApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];

  constructor(
    message: string,
    status: number,
    code = 'ATTENDANCE_REQUEST_FAILED',
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AttendanceApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors ?? {};
    this.formErrors = details?.formErrors ?? [];
  }
}

// Narrows untrusted JSON to a property container before any value is read.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Enforces the exact safe response keys so internal server fields cannot enter page state.
function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).toSorted();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
}

// Narrows the exact four public PALE codes without trusting a type assertion.
function isAttendanceStatusCode(value: unknown): value is AttendanceStatusCode {
  return value === 'P' || value === 'A' || value === 'L' || value === 'E';
}

// Validates a date-only string without converting through browser local time.
function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Validates the safe student identity embedded in a roster snapshot.
function isAttendanceStudentRecord(value: unknown): value is AttendanceStudentRecord {
  return isRecord(value) &&
    hasExactKeys(value, ['id', 'studentNo', 'firstName', 'lastName']) &&
    typeof value.id === 'string' && UUID_PATTERN.test(value.id) &&
    (typeof value.studentNo === 'string' || value.studentNo === null) &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string';
}

// Validates one saved or draft roster row, including its nullable database ID.
function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  if (!(isRecord(value) &&
    hasExactKeys(value, ['id', 'student', 'status', 'remarks']) &&
    (value.id === null || typeof value.id === 'string' && UUID_PATTERN.test(value.id)) &&
    isAttendanceStudentRecord(value.student) &&
    (value.status === null || isAttendanceStatusCode(value.status)) &&
    (value.remarks === null ||
      (typeof value.remarks === 'string' && value.remarks.length <= ATTENDANCE_REMARKS_MAX_LENGTH)))) {
    return false;
  }

  return value.status === 'E'
    ? typeof value.remarks === 'string' && value.remarks.trim().length > 0
    : value.remarks === null;
}

// Validates a complete immutable roster snapshot and copied schedule-time pair.
function isAttendanceSessionRecord(value: unknown): value is AttendanceSessionRecord {
  if (!isRecord(value) || !hasExactKeys(value, [
    'id',
    'classId',
    'classScheduleId',
    'sessionDate',
    'startTime',
    'endTime',
    'isRosterInitialized',
    'records',
  ])) {
    return false;
  }

  const hasValidTimes = value.startTime === null && value.endTime === null ||
    typeof value.startTime === 'string' &&
    typeof value.endTime === 'string' &&
    TIME_PATTERN.test(value.startTime) &&
    TIME_PATTERN.test(value.endTime) &&
    value.endTime > value.startTime;

  if (
    typeof value.id !== 'string' || !UUID_PATTERN.test(value.id) ||
    typeof value.classId !== 'string' || !UUID_PATTERN.test(value.classId) ||
    !(value.classScheduleId === null ||
      typeof value.classScheduleId === 'string' && UUID_PATTERN.test(value.classScheduleId)) ||
    !isDateOnly(value.sessionDate) ||
    !hasValidTimes ||
    typeof value.isRosterInitialized !== 'boolean' ||
    !Array.isArray(value.records) ||
    !value.records.every(isAttendanceRecord)
  ) {
    return false;
  }

  const studentIds = value.records.map((record) => record.student.id);
  return new Set(studentIds).size === studentIds.length &&
    value.records.every((record) => value.isRosterInitialized
      ? record.id !== null
      : record.id === null && record.status === null && record.remarks === null);
}

// Keeps only string-array field errors from the shared server validation envelope.
function readFieldErrors(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((message) => typeof message === 'string'),
  ));
}

// Converts one unsuccessful response body into a reusable Attendance API error.
async function readApiError(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return new AttendanceApiError('Unable to complete the attendance request.', response.status);
  }

  if (!isRecord(payload) || !isRecord(payload.error)) {
    return new AttendanceApiError('Unable to complete the attendance request.', response.status);
  }

  const message = typeof payload.error.message === 'string'
    ? payload.error.message
    : 'Unable to complete the attendance request.';
  const code = typeof payload.error.code === 'string'
    ? payload.error.code
    : 'ATTENDANCE_REQUEST_FAILED';
  const details = isRecord(payload.error.details)
    ? {
      fieldErrors: readFieldErrors(payload.error.details.fieldErrors),
      formErrors: Array.isArray(payload.error.details.formErrors) &&
        payload.error.details.formErrors.every((item) => typeof item === 'string')
        ? payload.error.details.formErrors
        : undefined,
    }
    : undefined;

  return new AttendanceApiError(message, response.status, code, details);
}

// Parses one success envelope before endpoint-specific data selection.
async function readSuccessData<Result>(
  response: Response,
  errorMessage: string,
  readData: (data: Record<string, unknown>) => Result | undefined,
) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new AttendanceApiError(errorMessage, response.status);
  }

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new AttendanceApiError(errorMessage, response.status);
  }

  const result = readData(payload.data);
  if (result === undefined) {
    throw new AttendanceApiError(errorMessage, response.status);
  }

  return result;
}

// Selects one validated session from create, load, and save responses.
function readSession(data: Record<string, unknown>) {
  return isAttendanceSessionRecord(data.session) ? data.session : undefined;
}

// Selects the complete validated session collection returned for one class.
function readSessions(data: Record<string, unknown>) {
  return Array.isArray(data.sessions) &&
    data.sessions.length <= 31 &&
    data.sessions.every(isAttendanceSessionRecord)
    ? data.sessions
    : undefined;
}

// Selects the identifier confirmed after deleting one complete Attendance date.
function readDeletedSessionId(data: Record<string, unknown>) {
  return typeof data.sessionId === 'string' && UUID_PATTERN.test(data.sessionId)
    ? data.sessionId
    : undefined;
}

// Preserves AbortError while converting network failures to the feature error type.
function handleNetworkError(error: unknown): never {
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw error;
  }

  throw new AttendanceApiError('Unable to reach PALE Records.', 0);
}

// Creates one persisted class/date session and its server-snapshotted roster.
export async function createAttendanceSession(classId: string, sessionDate: string) {
  let response: Response;

  try {
    response = await fetch(`/api/attendance/classes/${encodeURIComponent(classId)}/sessions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionDate }),
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the created attendance session.', readSession);
}

// Ensures scheduled dates once for a class/month and returns that month's draft or saved rosters.
export async function ensureAttendanceSessionMonth(
  classId: string,
  year: number,
  month: number,
  signal: AbortSignal,
) {
  let response: Response;

  try {
    response = await fetch(
      `/api/attendance/classes/${encodeURIComponent(classId)}/session-months`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
        signal,
      },
    );
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the attendance month.', readSessions);
}

// Loads at most 31 newest complete sessions for one class.
export async function listAttendanceSessions(classId: string, signal: AbortSignal) {
  let response: Response;

  try {
    response = await fetch(`/api/attendance/classes/${encodeURIComponent(classId)}/sessions`, {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read saved attendance sessions.', readSessions);
}

// Loads one complete saved Attendance session by its database identifier.
export async function loadAttendanceSession(sessionId: string, signal: AbortSignal) {
  let response: Response;

  try {
    response = await fetch(`/api/attendance/sessions/${encodeURIComponent(sessionId)}`, {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the attendance session.', readSession);
}

// Deletes one persisted Attendance date and all roster records owned by that session.
export async function deleteAttendanceSession(sessionId: string) {
  let response: Response;

  try {
    response = await fetch(`/api/attendance/sessions/${encodeURIComponent(sessionId)}`, {
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
    'Unable to confirm the deleted attendance date.',
    readDeletedSessionId,
  );
}

// Atomically saves the complete persisted roster and returns the validated server snapshot.
export async function saveAttendanceSessionRecords(
  sessionId: string,
  records: SaveAttendanceRecordInput[],
) {
  let response: Response;

  try {
    response = await fetch(`/api/attendance/sessions/${encodeURIComponent(sessionId)}/records`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the saved attendance session.', readSession);
}
