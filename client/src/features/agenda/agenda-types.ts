// Defines data models, event categories, and calendar structures for the Agenda workspace.
export type AgendaEventType =
  | 'EXAM'
  | 'ASSIGNMENT'
  | 'ACTIVITY'
  | 'HOLIDAY'
  | 'MEETING'
  | 'NOTE';

export interface AgendaEventTypeConfig {
  type: AgendaEventType;
  label: string;
  shortLabel: string;
  badgeStyle: string;
  pipColor: string;
}

export const AGENDA_EVENT_TYPES: ReadonlyArray<AgendaEventTypeConfig> = [
  {
    type: 'EXAM',
    label: 'Examination',
    shortLabel: 'Exam',
    badgeStyle: 'border-signal-red text-signal-red bg-signal-red/10',
    pipColor: 'bg-signal-red',
  },
  {
    type: 'ASSIGNMENT',
    label: 'Assignment / Deadline',
    shortLabel: 'Deadline',
    badgeStyle: 'border-signal-amber text-signal-amber bg-signal-amber/10',
    pipColor: 'bg-signal-amber',
  },
  {
    type: 'ACTIVITY',
    label: 'Class Activity',
    shortLabel: 'Activity',
    badgeStyle: 'border-signal-blue text-signal-blue bg-signal-blue/10',
    pipColor: 'bg-signal-blue',
  },
  {
    type: 'HOLIDAY',
    label: 'Academic Holiday',
    shortLabel: 'Holiday',
    badgeStyle: 'border-signal-emerald text-signal-emerald bg-signal-emerald/10',
    pipColor: 'bg-signal-emerald',
  },
  {
    type: 'MEETING',
    label: 'Faculty Meeting',
    shortLabel: 'Meeting',
    badgeStyle: 'border-ink text-ink bg-paper-muted',
    pipColor: 'bg-ink',
  },
  {
    type: 'NOTE',
    label: 'General Note',
    shortLabel: 'Note',
    badgeStyle: 'border-ink-muted text-ink-muted bg-paper',
    pipColor: 'bg-ink-muted',
  },
];

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string; // ISO Date YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  isAllDay: boolean;
  eventType: AgendaEventType;
  classId: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgendaEventInput {
  title: string;
  description?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  eventType: AgendaEventType;
  classId?: string;
  location?: string;
}

export interface UpdateAgendaEventInput {
  title: string;
  description?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  eventType: AgendaEventType;
  classId?: string;
  location?: string;
}

export interface SyncedClassSession {
  id: string;
  classId: string;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
  room: string | null;
  teacher: string | null;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  sessionDate: string; // YYYY-MM-DD
}

export interface CalendarDayCell {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: AgendaEvent[];
  syncedSessions: SyncedClassSession[];
}

export type AgendaTypeFilter = 'ALL' | 'CUSTOM_EVENTS' | 'CLASS_SESSIONS' | AgendaEventType;
