// Defines authenticated Profile and per-user System preference contracts.
import type { AuthenticatedUser } from '../auth/auth-api';

export interface ProfileSettingsState {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
}

export interface PasswordChangeState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SystemPreferences {
  defaultSchoolYear: string | null;
  defaultSemester: string | null;
  defaultAttendanceState: 'PRESENT' | 'UNRECORDED';
  tableDensity: 'COMFORTABLE' | 'COMPACT';
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timeFormat: '12H' | '24H';
  defaultExportFormat: 'PDF' | 'CSV';
}

export interface AcademicPreferenceOptions {
  schoolYears: string[];
  semesters: string[];
}

export function getInitialProfileState(
  currentUser?: AuthenticatedUser | null,
): ProfileSettingsState {
  return {
    firstName: currentUser?.firstName ?? '',
    lastName: currentUser?.lastName ?? '',
    email: currentUser?.email ?? '',
    username: currentUser?.username ?? '',
  };
}
