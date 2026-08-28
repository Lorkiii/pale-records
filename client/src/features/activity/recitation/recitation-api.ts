// Owns credentialed Recitation requests and exact runtime response validation.
import type {
  RecitationMarkCode,
  RecitationRecord,
  RecitationSessionRecord,
  RecitationStudentRecord,
  SaveRecitationRecordInput,
} from './recitation-types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

// Carries safe HTTP, product-code, and validation details to the Activity workspace.
export class RecitationApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];

  constructor(
    message: string,
    status: number,
    code = 'RECITATION_REQUEST_FAILED',
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'RecitationApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors ?? {};
    this.formErrors = details?.formErrors ?? [];
  }
}

// Narrows untrusted JSON to a property container before any value is read.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Enforces exact safe keys so internal server fields cannot enter React state.
function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).toSorted();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
}

// Validates a real date-only value using UTC only for calendar arithmetic.
function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Narrows the only two non-null public Recitation marks.
function isRecitationMarkCode(value: unknown): value is RecitationMarkCode {
  return value === 'CHECK' || value === 'X';
}

// Validates one complete-roster request row before constructing JSON.
function isSaveRecitationRecordInput(
  value: SaveRecitationRecordInput,
) {
  return UUID_PATTERN.test(value.studentId) &&
    (value.mark === null || isRecitationMarkCode(value.mark));
}

// Validates the exact safe student identity embedded in a roster record.
function isRecitationStudentRecord(value: unknown): value is RecitationStudentRecord {
  return isRecord(value) &&
    hasExactKeys(value, ['id', 'studentNo', 'firstName', 'lastName']) &&
    typeof value.id === 'string' && UUID_PATTERN.test(value.id) &&
    (typeof value.studentNo === 'string' || value.studentNo === null) &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string';
}

// Validates one saved or response-only draft roster record.
function isRecitationRecord(value: unknown): value is RecitationRecord {
  return isRecord(value) &&
    hasExactKeys(value, ['id', 'student', 'mark']) &&
    (value.id === null || typeof value.id === 'string' && UUID_PATTERN.test(value.id)) &&
    isRecitationStudentRecord(value.student) &&
    (value.mark === null || isRecitationMarkCode(value.mark));
}

// Validates one complete session and its initialized-versus-draft invariant.
function isRecitationSessionRecord(value: unknown): value is RecitationSessionRecord {
  if (!isRecord(value) || !hasExactKeys(value, [
    'id',
    'classId',
    'sessionDate',
    'isRosterInitialized',
    'records',
  ])) {
    return false;
  }

  if (
    typeof value.id !== 'string' || !UUID_PATTERN.test(value.id) ||
    typeof value.classId !== 'string' || !UUID_PATTERN.test(value.classId) ||
    !isDateOnly(value.sessionDate) ||
    typeof value.isRosterInitialized !== 'boolean' ||
    !Array.isArray(value.records) ||
    value.records.length > 100 ||
    !value.records.every(isRecitationRecord)
  ) {
    return false;
  }

  const studentIds = value.records.map((record) => record.student.id);
  return new Set(studentIds).size === studentIds.length &&
    value.records.every((record) => value.isRosterInitialized
      ? record.id !== null
      : record.id === null && record.mark === null);
}

// Keeps only string-array field errors from the shared validation envelope.
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

// Converts an unsuccessful safe envelope into the feature API error type.
async function readApiError(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return new RecitationApiError('Unable to complete the Recitation request.', response.status);
  }

  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'error']) ||
    payload.success !== false ||
    !isRecord(payload.error)
  ) {
    return new RecitationApiError('Unable to complete the Recitation request.', response.status);
  }

  const errorKeys = Object.hasOwn(payload.error, 'details')
    ? ['code', 'message', 'details']
    : ['code', 'message'];
  if (
    !hasExactKeys(payload.error, errorKeys) ||
    typeof payload.error.code !== 'string' ||
    typeof payload.error.message !== 'string'
  ) {
    return new RecitationApiError('Unable to complete the Recitation request.', response.status);
  }

  const details = Object.hasOwn(payload.error, 'details')
    ? readErrorDetails(payload.error.details)
    : undefined;
  if (Object.hasOwn(payload.error, 'details') && !details) {
    return new RecitationApiError('Unable to complete the Recitation request.', response.status);
  }

  return new RecitationApiError(
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

    throw new RecitationApiError(errorMessage, response.status);
  }

  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true ||
    !isRecord(payload.data)
  ) {
    throw new RecitationApiError(errorMessage, response.status);
  }

  const result = readData(payload.data);
  if (result === undefined) {
    throw new RecitationApiError(errorMessage, response.status);
  }

  return result;
}

// Selects one exact validated session from create and save responses.
function readSession(data: Record<string, unknown>) {
  return hasExactKeys(data, ['session']) && isRecitationSessionRecord(data.session)
    ? data.session
    : undefined;
}

// Selects the exact bounded session collection returned for one class month.
function readSessions(data: Record<string, unknown>) {
  if (
    !hasExactKeys(data, ['sessions']) ||
    !Array.isArray(data.sessions) ||
    data.sessions.length > 31 ||
    !data.sessions.every(isRecitationSessionRecord)
  ) {
    return undefined;
  }

  const sessionIds = data.sessions.map((session) => session.id);
  const sessionDates = data.sessions.map((session) => session.sessionDate);
  return new Set(sessionIds).size === sessionIds.length &&
    new Set(sessionDates).size === sessionDates.length
    ? data.sessions
    : undefined;
}

// Preserves AbortError while converting other network failures to a feature error.
function handleNetworkError(error: unknown): never {
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw error;
  }

  throw new RecitationApiError('Unable to reach PALE Records.', 0);
}

// Creates one manual class/date Recitation session.
export async function createRecitationSession(
  classId: string,
  sessionDate: string,
) {
  if (!UUID_PATTERN.test(classId) || !isDateOnly(sessionDate)) {
    throw new RecitationApiError(
      'Choose a valid class and Recitation date.',
      400,
      'RECITATION_CLIENT_INPUT_INVALID',
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `/api/recitations/classes/${encodeURIComponent(classId)}/sessions`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDate }),
      },
    );
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const session = await readSuccessData(
    response,
    'Unable to read the created Recitation session.',
    readSession,
  );
  if (
    session.classId !== classId ||
    session.sessionDate !== sessionDate ||
    session.isRosterInitialized
  ) {
    throw new RecitationApiError('The created Recitation session did not match the request.', response.status);
  }

  return session;
}

// Lists at most 31 validated Recitation sessions for one class and calendar month.
export async function listRecitationSessions(
  classId: string,
  year: number,
  month: number,
  signal: AbortSignal,
) {
  if (
    !UUID_PATTERN.test(classId) ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RecitationApiError(
      'Choose a valid class and calendar month.',
      400,
      'RECITATION_CLIENT_INPUT_INVALID',
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `/api/recitations/classes/${encodeURIComponent(classId)}/sessions?year=${year}&month=${month}`,
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

  const sessions = await readSuccessData(
    response,
    'Unable to read the Recitation month.',
    readSessions,
  );
  const monthPrefix = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
  if (sessions.some((session) => (
    session.classId !== classId || !session.sessionDate.startsWith(`${monthPrefix}-`)
  ))) {
    throw new RecitationApiError('The Recitation month did not match the request.', response.status);
  }

  return sessions;
}

// Saves every selected roster student once and returns the validated server snapshot.
export async function saveRecitationSessionRecords(
  expectedSession: Pick<RecitationSessionRecord, 'id' | 'classId' | 'sessionDate'>,
  records: SaveRecitationRecordInput[],
) {
  const sessionId = expectedSession.id;
  const studentIds = records.map((record) => record.studentId);
  if (
    !UUID_PATTERN.test(sessionId) ||
    !UUID_PATTERN.test(expectedSession.classId) ||
    !isDateOnly(expectedSession.sessionDate) ||
    records.length > 100 ||
    new Set(studentIds).size !== studentIds.length ||
    !records.every(isSaveRecitationRecordInput)
  ) {
    throw new RecitationApiError(
      'The complete Recitation roster must contain at most 100 unique students.',
      400,
      'RECITATION_CLIENT_ROSTER_INVALID',
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `/api/recitations/sessions/${encodeURIComponent(sessionId)}/records`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      },
    );
  } catch (error) {
    handleNetworkError(error);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  const session = await readSuccessData(
    response,
    'Unable to read the saved Recitation session.',
    readSession,
  );
  const returnedStudentIds = session.records.map((record) => record.student.id);
  const submittedStudentIds = new Set(studentIds);
  if (
    session.id !== sessionId ||
    session.classId !== expectedSession.classId ||
    session.sessionDate !== expectedSession.sessionDate ||
    !session.isRosterInitialized ||
    returnedStudentIds.length !== studentIds.length ||
    !returnedStudentIds.every((studentId) => submittedStudentIds.has(studentId))
  ) {
    throw new RecitationApiError(
      'The saved Recitation session did not match the submitted roster.',
      response.status,
    );
  }

  return session;
}
