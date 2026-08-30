// Defines types, options, and default mock data for the Settings workspace.
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

export interface SystemSettingsState {
  defaultAcademicYear: string;
  defaultTerm: string;
  attendanceGracePeriod: string;
  defaultAttendanceStatus: 'PRESENT' | 'UNRECORDED';
  tableDensity: 'COMFORTABLE' | 'COMPACT';
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timeFormat: '12H' | '24H';
  defaultExportFormat: 'CSV' | 'PDF';
}

export interface NotificationSettingsState {
  agendaUpcomingReminders: boolean;
  agendaReminderLeadTime: '15m' | '30m' | '1h' | '1d';
  facultyMeetingAlerts: boolean;
  unrecordedAttendanceAlerts: boolean;
  unpostedScoreAlerts: boolean;
  stickyBannerToasts: boolean;
  showSidebarBadgeCounters: boolean;
  quietModeDuringLectures: boolean;
}

export type CategoryAccentColor =
  | 'signal-red'
  | 'signal-amber'
  | 'signal-emerald'
  | 'signal-blue'
  | 'ink'
  | 'ink-muted';

export interface CategoryAccentConfig {
  color: CategoryAccentColor;
  label: string;
  badgeStyle: string;
  pipColor: string;
}

export interface AgendaCategoryItem {
  id: string;
  name: string;
  shortCode: string;
  accent: CategoryAccentColor;
  description: string;
  isSystem: boolean;
  isActive: boolean;
}

export const CATEGORY_ACCENT_CONFIGS: Record<CategoryAccentColor, CategoryAccentConfig> = {
  'signal-red': {
    color: 'signal-red',
    label: 'Signal Red',
    badgeStyle: 'border-signal-red text-signal-red bg-signal-red/10',
    pipColor: 'bg-signal-red',
  },
  'signal-amber': {
    color: 'signal-amber',
    label: 'Signal Amber',
    badgeStyle: 'border-signal-amber text-signal-amber bg-signal-amber/10',
    pipColor: 'bg-signal-amber',
  },
  'signal-emerald': {
    color: 'signal-emerald',
    label: 'Signal Emerald',
    badgeStyle: 'border-signal-emerald text-signal-emerald bg-signal-emerald/10',
    pipColor: 'bg-signal-emerald',
  },
  'signal-blue': {
    color: 'signal-blue',
    label: 'Signal Blue',
    badgeStyle: 'border-signal-blue text-signal-blue bg-signal-blue/10',
    pipColor: 'bg-signal-blue',
  },
  ink: {
    color: 'ink',
    label: 'Ink Black',
    badgeStyle: 'border-ink text-ink bg-paper-muted',
    pipColor: 'bg-ink',
  },
  'ink-muted': {
    color: 'ink-muted',
    label: 'Muted Ink',
    badgeStyle: 'border-ink-muted text-ink-muted bg-paper',
    pipColor: 'bg-ink-muted',
  },
};

export const INITIAL_AGENDA_CATEGORIES: AgendaCategoryItem[] = [
  {
    id: 'cat-exam',
    name: 'Examination',
    shortCode: 'EXAM',
    accent: 'signal-red',
    description: 'Major examinations, midterms, and finals.',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'cat-assignment',
    name: 'Assignment / Deadline',
    shortCode: 'DEADLINE',
    accent: 'signal-amber',
    description: 'Problem sets, essays, project submissions, and homework.',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'cat-activity',
    name: 'Class Activity',
    shortCode: 'ACTIVITY',
    accent: 'signal-blue',
    description: 'Recitations, laboratory work, presentations, and group discussions.',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'cat-holiday',
    name: 'Academic Holiday',
    shortCode: 'HOLIDAY',
    accent: 'signal-emerald',
    description: 'Institutional breaks, national holidays, and official non-working days.',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'cat-meeting',
    name: 'Faculty Meeting',
    shortCode: 'MEETING',
    accent: 'ink',
    description: 'Departmental meetings, college assemblies, and committee work.',
    isSystem: true,
    isActive: true,
  },
  {
    id: 'cat-consultation',
    name: 'Student Consultation',
    shortCode: 'CNSLT',
    accent: 'signal-blue',
    description: 'One-on-one academic consultations and thesis advising hours.',
    isSystem: false,
    isActive: true,
  },
  {
    id: 'cat-remedial',
    name: 'Remedial Session',
    shortCode: 'REMED',
    accent: 'signal-amber',
    description: 'Make-up classes, tutorials, and supplemental review sessions.',
    isSystem: false,
    isActive: true,
  },
];

export function getInitialProfileState(currentUser?: AuthenticatedUser | null): ProfileSettingsState {
  return {
    firstName: currentUser?.firstName ?? 'Faculty',
    lastName: currentUser?.lastName ?? 'Member',
    email: currentUser?.email ?? 'faculty@university.edu.ph',
    username: currentUser?.username ?? 'faculty_user',
  };
}

export const INITIAL_SYSTEM_SETTINGS: SystemSettingsState = {
  defaultAcademicYear: '2025-2026',
  defaultTerm: '1ST_SEM',
  attendanceGracePeriod: '15',
  defaultAttendanceStatus: 'PRESENT',
  tableDensity: 'COMFORTABLE',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '12H',
  defaultExportFormat: 'PDF',
};

export const INITIAL_NOTIFICATION_SETTINGS: NotificationSettingsState = {
  agendaUpcomingReminders: true,
  agendaReminderLeadTime: '15m',
  facultyMeetingAlerts: true,
  unrecordedAttendanceAlerts: true,
  unpostedScoreAlerts: false,
  stickyBannerToasts: false,
  showSidebarBadgeCounters: true,
  quietModeDuringLectures: true,
};
