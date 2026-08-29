// Provides date calculations, calendar matrix generators, and class schedule projection utilities.
import type { ClassRecord } from '../classes/class-types';
import type { CalendarDayCell, AgendaEvent, SyncedClassSession } from './agenda-types';

export const DAYS_OF_WEEK_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// Formats a Date object into a stable local YYYY-MM-DD string.
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parses a YYYY-MM-DD string into a local Date object.
export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

// Formats a date key for long display, e.g., "24 October 2026".
export function formatDateDisplay(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Returns the full weekday name in uppercase for a date key, e.g., "FRIDAY".
export function formatDayOfWeekName(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

// Formats month and year header, e.g., "OCTOBER 2026".
export function formatMonthYearHeader(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex].toUpperCase()} ${year}`;
}

// Returns ISO day of week (1 = Monday, 7 = Sunday).
export function getIsoDayOfWeek(date: Date): number {
  const jsDay = date.getDay(); // 0 = Sunday, 1 = Monday
  return jsDay === 0 ? 7 : jsDay;
}

// Checks if a given dateKey matches today.
export function isTodayKey(dateKey: string): boolean {
  return dateKey === formatDateKey(new Date());
}

// Generates the full 35- or 42-day calendar matrix for a specified month and year.
export function buildMonthMatrix(
  year: number,
  monthIndex: number,
  selectedDateKey: string,
  eventsByDate: Map<string, AgendaEvent[]>,
  sessionsByDate: Map<string, SyncedClassSession[]>,
): CalendarDayCell[] {
  const todayKey = formatDateKey(new Date());
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  const startIsoDay = getIsoDayOfWeek(firstDayOfMonth); // 1 to 7
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const cells: CalendarDayCell[] = [];

  // 1. Fill leading days from previous month
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  const leadingDaysCount = startIsoDay - 1; // e.g. Mon=0, Tue=1, Sun=6
  for (let i = leadingDaysCount - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const date = new Date(year, monthIndex - 1, dayNum);
    const dateKey = formatDateKey(date);
    cells.push({
      date,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      events: eventsByDate.get(dateKey) || [],
      syncedSessions: sessionsByDate.get(dateKey) || [],
    });
  }

  // 2. Fill current month days
  for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
    const date = new Date(year, monthIndex, dayNum);
    const dateKey = formatDateKey(date);
    cells.push({
      date,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      events: eventsByDate.get(dateKey) || [],
      syncedSessions: sessionsByDate.get(dateKey) || [],
    });
  }

  // 3. Fill trailing days from next month to complete standard weeks (multiple of 7)
  const remainingCells = (7 - (cells.length % 7)) % 7;
  // Ensure at least 5 weeks (35 cells) or 6 weeks (42 cells)
  const targetTotal = cells.length + remainingCells < 35 ? 35 : cells.length + remainingCells;
  const trailingDaysNeeded = targetTotal - cells.length;

  for (let dayNum = 1; dayNum <= trailingDaysNeeded; dayNum++) {
    const date = new Date(year, monthIndex + 1, dayNum);
    const dateKey = formatDateKey(date);
    cells.push({
      date,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      events: eventsByDate.get(dateKey) || [],
      syncedSessions: sessionsByDate.get(dateKey) || [],
    });
  }

  return cells;
}

// Projects recurring weekly class schedules onto calendar dates for an active range.
export function projectClassSchedulesForMonth(
  classes: ClassRecord[],
  year: number,
  monthIndex: number,
): Map<string, SyncedClassSession[]> {
  const map = new Map<string, SyncedClassSession[]>();

  // Scan from 7 days before month start to 7 days after month end to cover calendar padding
  const startDate = new Date(year, monthIndex - 1, 20);
  const endDate = new Date(year, monthIndex + 1, 14);

  for (let curr = new Date(startDate); curr <= endDate; curr.setDate(curr.getDate() + 1)) {
    const dateKey = formatDateKey(curr);
    const isoDay = getIsoDayOfWeek(curr);
    const dateIsoStr = curr.toISOString().split('T')[0];

    for (const cls of classes) {
      // Check semester / class bounds if set
      if (cls.startDate && dateIsoStr < cls.startDate.split('T')[0]) continue;
      if (cls.endDate && dateIsoStr > cls.endDate.split('T')[0]) continue;

      if (!cls.schedules || cls.schedules.length === 0) continue;

      for (const sched of cls.schedules) {
        if (sched.dayOfWeek === isoDay) {
          const session: SyncedClassSession = {
            id: `${cls.id}-${dateKey}-${sched.id}`,
            classId: cls.id,
            subjectName: cls.subjectName,
            subjectCode: cls.subjectCode,
            section: cls.section,
            room: cls.room,
            teacher: cls.teacher,
            startTime: sched.startTime,
            endTime: sched.endTime,
            dayOfWeek: sched.dayOfWeek,
            sessionDate: dateKey,
          };

          const existing = map.get(dateKey) || [];
          existing.push(session);
          map.set(dateKey, existing);
        }
      }
    }
  }

  // Sort sessions within each day by start time
  for (const [key, sessions] of map.entries()) {
    sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
    map.set(key, sessions);
  }

  return map;
}
