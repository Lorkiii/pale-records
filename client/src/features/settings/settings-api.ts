// Owns credentialed Settings requests with strict safe-response parsing.
import type { AuthenticatedUser } from '../auth/auth-api';
import type { AcademicPreferenceOptions, SystemPreferences } from './settings-types';

export interface ProfileSettingsPayload {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
}

export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
}

export interface SettingsSnapshot {
  system: SystemPreferences;
  academicOptions: AcademicPreferenceOptions;
}

type SettingsFieldName =
  | keyof ProfileSettingsPayload
  | keyof PasswordChangePayload
  | keyof SystemPreferences;

export class SettingsApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fieldErrors: Partial<Record<SettingsFieldName, string>>;

  constructor(
    message: string,
    status: number,
    code?: string,
    fieldErrors: Partial<Record<SettingsFieldName, string>> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return isRecord(value) &&
    hasExactKeys(value, ['id', 'firstName', 'lastName', 'username', 'email']) &&
    typeof value.id === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    (typeof value.username === 'string' || value.username === null) &&
    typeof value.email === 'string';
}

function readFieldErrors(value: unknown): Partial<Record<SettingsFieldName, string>> {
  if (!isRecord(value)) return {};
  const fieldErrors = value.fieldErrors;
  if (!isRecord(fieldErrors)) return {};

  const supportedFields: SettingsFieldName[] = [
    'firstName', 'lastName', 'email', 'username', 'currentPassword', 'newPassword',
    'defaultSchoolYear', 'defaultSemester', 'defaultAttendanceState', 'tableDensity',
    'dateFormat', 'timeFormat', 'defaultExportFormat',
  ];
  return supportedFields.reduce<Partial<Record<SettingsFieldName, string>>>(
    (fieldErrors, field) => {
      const messages = fieldErrors[field];
      if (Array.isArray(messages) && typeof messages[0] === 'string') {
        fieldErrors[field] = messages[0];
      }
      return fieldErrors;
    },
    {},
  );
}

async function readError(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (
      isRecord(payload) &&
      hasExactKeys(payload, ['success', 'error']) &&
      payload.success === false &&
      isRecord(payload.error) &&
      hasExactKeys(
        payload.error,
        Object.hasOwn(payload.error, 'details')
          ? ['code', 'message', 'details']
          : ['code', 'message'],
      ) &&
      typeof payload.error.message === 'string' &&
      typeof payload.error.code === 'string'
    ) {
      return new SettingsApiError(
        payload.error.message,
        response.status,
        payload.error.code,
        readFieldErrors(payload.error.details),
      );
    }
  } catch {
    // Use the safe fallback below for malformed responses.
  }

  return new SettingsApiError('Unable to complete the Settings request.', response.status);
}

async function readJson(response: Response, message: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SettingsApiError(message, response.status);
  }
}

function isNullableAcademicValue(value: unknown): value is string | null {
  return value === null || (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 32
  );
}

function isSystemPreferences(value: unknown): value is SystemPreferences {
  return isRecord(value) &&
    hasExactKeys(value, [
      'defaultSchoolYear',
      'defaultSemester',
      'defaultAttendanceState',
      'tableDensity',
      'dateFormat',
      'timeFormat',
      'defaultExportFormat',
    ]) &&
    isNullableAcademicValue(value.defaultSchoolYear) &&
    isNullableAcademicValue(value.defaultSemester) &&
    (value.defaultAttendanceState === 'PRESENT' || value.defaultAttendanceState === 'UNRECORDED') &&
    (value.tableDensity === 'COMFORTABLE' || value.tableDensity === 'COMPACT') &&
    (value.dateFormat === 'YYYY-MM-DD' || value.dateFormat === 'DD/MM/YYYY' || value.dateFormat === 'MM/DD/YYYY') &&
    (value.timeFormat === '12H' || value.timeFormat === '24H') &&
    (value.defaultExportFormat === 'PDF' || value.defaultExportFormat === 'CSV');
}

function isAcademicOptions(value: unknown): value is AcademicPreferenceOptions {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schoolYears', 'semesters']) ||
    !Array.isArray(value.schoolYears) ||
    !Array.isArray(value.semesters)
  ) {
    return false;
  }

  return [value.schoolYears, value.semesters].every((options) =>
    options.length <= 500 &&
    options.every((option) =>
      typeof option === 'string' &&
      option === option.trim() &&
      option.length >= 1 &&
      option.length <= 32
    ) &&
    new Set(options).size === options.length
  );
}

async function readProfile(response: Response) {
  const payload = await readJson(response, 'Unable to read the saved Profile.');
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !hasExactKeys(payload.data, ['user']) ||
    !isAuthenticatedUser(payload.data.user)
  ) {
    throw new SettingsApiError('Unable to read the saved Profile.', response.status);
  }
  return payload.data.user;
}

async function readPasswordChange(response: Response) {
  const payload = await readJson(response, 'Unable to confirm the password change.');
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !hasExactKeys(payload.data, ['message']) ||
    payload.data.message !== 'Password changed. Sign in again to continue.'
  ) {
    throw new SettingsApiError('Unable to confirm the password change.', response.status);
  }
}

async function readSettingsSnapshot(response: Response): Promise<SettingsSnapshot> {
  const payload = await readJson(response, 'Unable to read System preferences.');
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !hasExactKeys(payload.data, ['system', 'academicOptions']) ||
    !isSystemPreferences(payload.data.system) ||
    !isAcademicOptions(payload.data.academicOptions)
  ) {
    throw new SettingsApiError('Unable to read System preferences.', response.status);
  }

  return {
    system: payload.data.system,
    academicOptions: payload.data.academicOptions,
  };
}

async function readSystemPreferences(response: Response): Promise<SystemPreferences> {
  const payload = await readJson(response, 'Unable to read the saved System preferences.');
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ['success', 'data']) ||
    payload.success !== true ||
    !isRecord(payload.data) ||
    !hasExactKeys(payload.data, ['system']) ||
    !isSystemPreferences(payload.data.system)
  ) {
    throw new SettingsApiError('Unable to read the saved System preferences.', response.status);
  }

  return payload.data.system;
}

export async function fetchSettings(signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch('/api/settings', {
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new SettingsApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) throw await readError(response);
  return readSettingsSnapshot(response);
}

export async function updateProfile(input: ProfileSettingsPayload) {
  let response: Response;
  try {
    response = await fetch('/api/settings/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SettingsApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) throw await readError(response);
  return readProfile(response);
}

export async function changePassword(input: PasswordChangePayload) {
  let response: Response;
  try {
    response = await fetch('/api/settings/password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SettingsApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) throw await readError(response);
  await readPasswordChange(response);
}

export async function updateSystemPreferences(input: SystemPreferences) {
  let response: Response;
  try {
    response = await fetch('/api/settings/system', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SettingsApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) throw await readError(response);
  return readSystemPreferences(response);
}

export async function resetSystemPreferences() {
  let response: Response;
  try {
    response = await fetch('/api/settings/system/reset', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    throw new SettingsApiError('Unable to reach PALE Records.', 0);
  }

  if (!response.ok) throw await readError(response);
  return readSystemPreferences(response);
}
