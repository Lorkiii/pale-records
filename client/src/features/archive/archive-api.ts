// Validates archived list and password-confirmed deletion responses at the client boundary.
import type {
  ArchivedClassRecord,
  ArchivedStudentRecord,
  ArchivePage,
} from './archive-types';

export class ArchiveApiError extends Error {
  readonly status: number;
  readonly blockedIds: string[];

  constructor(
    message: string,
    status: number,
    blockedIds: string[] = [],
  ) {
    super(message);
    this.name = 'ArchiveApiError';
    this.status = status;
    this.blockedIds = blockedIds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isArchivedClass(value: unknown): value is ArchivedClassRecord {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.subjectName === 'string' &&
    isNullableString(value.subjectCode) &&
    isNullableString(value.section) &&
    isNullableString(value.schoolYear) &&
    isNullableString(value.semester) &&
    typeof value.archivedAt === 'string' &&
    !Number.isNaN(Date.parse(value.archivedAt)) &&
    typeof value.canDelete === 'boolean';
}

function isArchivedStudent(value: unknown): value is ArchivedStudentRecord {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.studentNo) &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    typeof value.archivedAt === 'string' &&
    !Number.isNaN(Date.parse(value.archivedAt)) &&
    typeof value.canDelete === 'boolean' &&
    Array.isArray(value.classes) &&
    value.classes.every((classRecord) => isRecord(classRecord) &&
      typeof classRecord.id === 'string' &&
      typeof classRecord.subjectName === 'string' &&
      isNullableString(classRecord.subjectCode) &&
      isNullableString(classRecord.section));
}

async function readError(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ArchiveApiError('Unable to complete the archive request.', response.status);
  }
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return new ArchiveApiError('Unable to complete the archive request.', response.status);
  }
  const message = typeof payload.error.message === 'string'
    ? payload.error.message
    : 'Unable to complete the archive request.';
  const details = payload.error.details;
  const blockedIds = isRecord(details) && Array.isArray(details.blockedIds) &&
    details.blockedIds.every((id) => typeof id === 'string')
    ? details.blockedIds
    : [];
  return new ArchiveApiError(message, response.status, blockedIds);
}

async function request(path: string, init: RequestInit, fallback: string) {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'include', ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ArchiveApiError('Unable to reach PALE Records.', 0);
  }
  if (!response.ok) throw await readError(response);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ArchiveApiError(fallback, response.status);
  }
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new ArchiveApiError(fallback, response.status);
  }
  return payload.data;
}

export async function fetchArchivedClasses(
  page: number,
  signal: AbortSignal,
): Promise<ArchivePage<ArchivedClassRecord>> {
  const data = await request(`/api/classes/archived?page=${page}`, { signal }, 'Unable to read archived classes.');
  if (!Array.isArray(data.classes) || !data.classes.every(isArchivedClass) ||
    typeof data.hasMore !== 'boolean') {
    throw new ArchiveApiError('Unable to read archived classes.', 200);
  }
  return { records: data.classes, hasMore: data.hasMore };
}

export async function fetchArchivedStudents(
  page: number,
  signal: AbortSignal,
): Promise<ArchivePage<ArchivedStudentRecord>> {
  const data = await request(`/api/students/archived?page=${page}`, { signal }, 'Unable to read archived students.');
  if (!Array.isArray(data.students) || !data.students.every(isArchivedStudent) ||
    typeof data.hasMore !== 'boolean') {
    throw new ArchiveApiError('Unable to read archived students.', 200);
  }
  return { records: data.students, hasMore: data.hasMore };
}

async function deleteArchived(resource: 'classes' | 'students', ids: string[], currentPassword: string) {
  const data = await request(`/api/${resource}/archived/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, currentPassword }),
  }, 'Unable to confirm deleted records.');
  if (!Array.isArray(data.deletedIds) ||
    data.deletedIds.length !== ids.length ||
    !data.deletedIds.every((id) => typeof id === 'string' && ids.includes(id))) {
    throw new ArchiveApiError('Unable to confirm deleted records.', 200);
  }
  return data.deletedIds as string[];
}

export function deleteArchivedClasses(ids: string[], currentPassword: string) {
  return deleteArchived('classes', ids, currentPassword);
}

export function deleteArchivedStudents(ids: string[], currentPassword: string) {
  return deleteArchived('students', ids, currentPassword);
}
