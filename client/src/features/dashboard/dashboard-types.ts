// Defines the public Dashboard overview records shared by its API, hook, and components.
import type { AgendaCategoryAccentKey } from '../agenda/agenda-types';

export type DashboardAttendanceStatus = 'optimal' | 'moderate' | 'at-risk';
export type DashboardWeekdayName = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
export type DashboardRecentUpdateType =
  | 'attendance'
  | 'recitation'
  | 'agenda'
  | 'class'
  | 'student';

export interface DashboardKpis {
  overallPresentRate: number | null;
  changeVsPreviousMonth: number | null;
  enrolledStudentCount: number;
  activeClassCount: number;
  upcomingEventCount: number;
}

export interface DashboardTodaySession {
  id: string;
  classId: string;
  subjectCode: string | null;
  subjectName: string;
  section: string | null;
  room: string | null;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  attendanceCompleted: boolean;
}

export interface DashboardUpcomingEvent {
  id: string;
  title: string;
  category: {
    shortCode: string;
    accentKey: AgendaCategoryAccentKey;
  };
  eventDate: string;
  startTime: string | null;
  isCompleted: boolean;
}

export interface DashboardClassSummary {
  classId: string;
  subjectCode: string | null;
  subjectName: string;
  section: string | null;
  enrolledCount: number;
  presentRate: number | null;
  lateRate: number | null;
  absentRate: number | null;
  excusedRate: number | null;
  status: DashboardAttendanceStatus | null;
}

export interface DashboardWeeklyAttendanceDay {
  dayName: DashboardWeekdayName;
  dateKey: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalMarked: number;
  presentRate: number | null;
}

export interface DashboardWeeklyAttendance {
  days: DashboardWeeklyAttendanceDay[];
  averagePresentRate: number | null;
}

export interface DashboardRecentUpdate {
  entityId: string;
  type: DashboardRecentUpdateType;
  title: string;
  description: string | null;
  occurredAt: string;
  classId: string | null;
  eventDate: string | null;
}

export interface DashboardOverviewData {
  asOfDate: string;
  kpis: DashboardKpis;
  todaySessions: DashboardTodaySession[];
  upcomingEvents: DashboardUpcomingEvent[];
  classSummaries: DashboardClassSummary[];
  weeklyAttendance: DashboardWeeklyAttendance;
  recentUpdates: DashboardRecentUpdate[];
}
