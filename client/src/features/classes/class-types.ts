// Defines class scalars and weekly schedule data shared by the API and class views.
export type ClassWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const CLASS_WEEKDAYS: ReadonlyArray<{
  value: ClassWeekday;
  label: string;
  shortLabel: string;
}> = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 7, label: 'Sunday', shortLabel: 'Sun' },
];

export interface ClassScheduleRecord {
  id: string;
  dayOfWeek: ClassWeekday;
  startTime: string;
  endTime: string;
}

export interface ClassScheduleInput {
  dayOfWeek: ClassWeekday;
  startTime: string;
  endTime: string;
}

export interface ClassRecord {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
  schoolYear: string | null;
  semester: string | null;
  teacher: string | null;
  room: string | null;
  startDate: string | null;
  endDate: string | null;
  schedules: ClassScheduleRecord[];
}

export interface CreateClassInput {
  subjectName: string;
  subjectCode?: string;
  section?: string;
  schoolYear?: string;
  semester?: string;
  teacher?: string;
  room?: string;
  startDate?: string;
  endDate?: string;
  schedules?: ClassScheduleInput[];
}

export type ClassScalarFieldName = Exclude<keyof CreateClassInput, 'schedules'>;
