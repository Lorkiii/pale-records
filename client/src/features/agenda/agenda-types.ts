// Defines Agenda categories, events, legacy import contracts, and calendar structures.
export type LegacyAgendaEventType =
  | 'EXAM'
  | 'ASSIGNMENT'
  | 'ACTIVITY'
  | 'HOLIDAY'
  | 'MEETING'
  | 'NOTE';

export type AgendaCategoryAccentKey =
  | 'SIGNAL_RED'
  | 'SIGNAL_ORANGE'
  | 'SIGNAL_AMBER'
  | 'SIGNAL_YELLOW'
  | 'SIGNAL_GOLD'
  | 'SIGNAL_OCHRE'
  | 'SIGNAL_MUSTARD'
  | 'SIGNAL_EMERALD'
  | 'SIGNAL_TEAL'
  | 'SIGNAL_BLUE'
  | 'SIGNAL_PURPLE'
  | 'SIGNAL_ROSE'
  | 'INK'
  | 'INK_MUTED';

export interface AgendaCategoryAccentConfig {
  label: string;
  badgeStyle: string;
  pipColor: string;
}

export const AGENDA_CATEGORY_ACCENTS: Record<AgendaCategoryAccentKey, AgendaCategoryAccentConfig> = {
  SIGNAL_RED: {
    label: 'Signal Red',
    badgeStyle: 'border-signal-red text-signal-red bg-signal-red/10',
    pipColor: 'bg-signal-red',
  },
  SIGNAL_ORANGE: {
    label: 'Signal Orange',
    badgeStyle: 'border-signal-orange text-signal-orange bg-signal-orange/10',
    pipColor: 'bg-signal-orange',
  },
  SIGNAL_AMBER: {
    label: 'Signal Amber',
    badgeStyle: 'border-signal-amber text-signal-amber bg-signal-amber/10',
    pipColor: 'bg-signal-amber',
  },
  SIGNAL_YELLOW: {
    label: 'Signal Yellow',
    badgeStyle: 'border-signal-yellow text-signal-yellow bg-signal-yellow/10',
    pipColor: 'bg-signal-yellow',
  },
  SIGNAL_GOLD: {
    label: 'Warm Gold',
    badgeStyle: 'border-signal-gold text-signal-gold bg-signal-gold/10',
    pipColor: 'bg-signal-gold',
  },
  SIGNAL_OCHRE: {
    label: 'Archival Ochre',
    badgeStyle: 'border-signal-ochre text-signal-ochre bg-signal-ochre/10',
    pipColor: 'bg-signal-ochre',
  },
  SIGNAL_MUSTARD: {
    label: 'Signal Mustard',
    badgeStyle: 'border-signal-mustard text-signal-mustard bg-signal-mustard/10',
    pipColor: 'bg-signal-mustard',
  },
  SIGNAL_EMERALD: {
    label: 'Signal Emerald',
    badgeStyle: 'border-signal-emerald text-signal-emerald bg-signal-emerald/10',
    pipColor: 'bg-signal-emerald',
  },
  SIGNAL_TEAL: {
    label: 'Signal Teal',
    badgeStyle: 'border-signal-teal text-signal-teal bg-signal-teal/10',
    pipColor: 'bg-signal-teal',
  },
  SIGNAL_BLUE: {
    label: 'Signal Blue',
    badgeStyle: 'border-signal-blue text-signal-blue bg-signal-blue/10',
    pipColor: 'bg-signal-blue',
  },
  SIGNAL_PURPLE: {
    label: 'Signal Purple',
    badgeStyle: 'border-signal-purple text-signal-purple bg-signal-purple/10',
    pipColor: 'bg-signal-purple',
  },
  SIGNAL_ROSE: {
    label: 'Signal Rose',
    badgeStyle: 'border-signal-rose text-signal-rose bg-signal-rose/10',
    pipColor: 'bg-signal-rose',
  },
  INK: {
    label: 'Ink Black',
    badgeStyle: 'border-ink text-ink bg-paper-muted',
    pipColor: 'bg-ink',
  },
  INK_MUTED: {
    label: 'Muted Ink',
    badgeStyle: 'border-ink-muted text-ink-muted bg-paper',
    pipColor: 'bg-ink-muted',
  },
};

export interface AgendaCategorySummary {
  id: string;
  name: string;
  shortCode: string;
  accentKey: AgendaCategoryAccentKey;
  isActive: boolean;
}

export interface AgendaCategory extends AgendaCategorySummary {
  description: string | null;
  isDefault: boolean;
}

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string; // ISO Date YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  isAllDay: boolean;
  categoryId: string;
  category: AgendaCategorySummary;
  classId: string | null;
  location: string | null;
  completedAt: string | null;
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
  categoryId: string;
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
  categoryId: string;
  classId?: string;
  location?: string;
}

export interface LegacyAgendaEventInput {
  legacyEventId: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  eventType: LegacyAgendaEventType;
  classId: string | null;
  location: string | null;
}

export interface AgendaLegacyImportAcknowledgement {
  event: AgendaEvent;
  imported: boolean;
  classAssociationRemoved: boolean;
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

export type AgendaTypeFilter = string;

export interface AgendaCategoryInput {
  name: string;
  shortCode: string;
  accentKey: AgendaCategoryAccentKey;
  description: string | null;
}

export interface UpdateAgendaCategoryInput extends AgendaCategoryInput {
  isActive: boolean;
}
