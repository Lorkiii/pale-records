// Owns authenticated student requests and validates their public response shapes.
import type {
  CreateStudentInput,
  StudentClassRecord,
  StudentRecord,
} from './student-types';

interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
}

// Carries HTTP and field-validation context from a failed student request.
export class StudentApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, details?: ErrorDetails) {
    super(message);
    this.name = 'StudentApiError';
    this.status = status;
    this.fieldErrors = details?.fieldErrors ?? {};
  }
}

// Narrows untrusted JSON to an object before any response properties are read.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Accepts the nullable string shape used by optional student and class fields.
function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

// Verifies one class summary returned inside a student record.
function isStudentClassRecord(value: unknown): value is StudentClassRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.subjectName === 'string' &&
    isNullableString(value.subjectCode) &&
    isNullableString(value.section)
  );
}

// Verifies a complete safe student response before it reaches page state.
function isStudentRecord(value: unknown): value is StudentRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.studentNo) &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    Array.isArray(value.classes) &&
    value.classes.every(isStudentClassRecord)
  );
}

// Keeps only server field errors that the student form can safely display.
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

// Converts an unsuccessful HTTP response into the shared student API error type.
async function readApiError(response: Response) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return new StudentApiError('Unable to complete the student request.', response.status);
  }

  if (!isRecord(payload) || !isRecord(payload.error)) {
    return new StudentApiError('Unable to complete the student request.', response.status);
  }

  const message = typeof payload.error.message === 'string'
    ? payload.error.message
    : 'Unable to complete the student request.';
  const details = isRecord(payload.error.details)
    ? { fieldErrors: readFieldErrors(payload.error.details.fieldErrors) }
    : undefined;

  return new StudentApiError(message, response.status, details);
}

// Parses a success envelope and delegates endpoint-specific data validation.
async function readSuccessData<Result>(
  response: Response,
  errorMessage: string,
  readData: (data: Record<string, unknown>) => Result | undefined,
) {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new StudentApiError(errorMessage, response.status);
  }

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new StudentApiError(errorMessage, response.status);
  }

  const result = readData(payload.data);

  if (result === undefined) {
    throw new StudentApiError(errorMessage, response.status);
  }

  return result;
}

// Selects and validates the saved student collection from response data.
function readStudents(data: Record<string, unknown>) {
  return Array.isArray(data.students) && data.students.every(isStudentRecord)
    ? data.students
    : undefined;
}

// Selects and validates the student returned after creation.
function readStudent(data: Record<string, unknown>) {
  return isStudentRecord(data.student) ? data.student : undefined;
}

// Loads the bounded saved student directory.
export async function fetchStudents(signal: AbortSignal) {
  let response: Response;

  try {
    response = await fetch('/api/students', {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new StudentApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the student directory.', readStudents);
}

// Persists one student and all selected class assignments.
export async function createStudent(input: CreateStudentInput) {
  let response: Response;

  try {
    response = await fetch('/api/students', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new StudentApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  return readSuccessData(response, 'Unable to read the created student.', readStudent);
}
