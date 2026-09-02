// Defines TypeScript contracts for Dashboard KPIs, attendance analytics, scheduled events, and quick actions.
import type { AgendaCategoryAccentKey } from '../agenda/agenda-types';

export interface DashboardKpiItem {
  id: string;
  code: string;
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'neutral' | 'negative';
  description: string;
}

export interface ClassAttendanceStat {
  classId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  enrolledCount: number;
  totalSessions: number;
  presentRate: number; // 0 to 100
  lateRate: number; // 0 to 100
  absentRate: number; // 0 to 100
  excusedRate: number; // 0 to 100
  status: 'optimal' | 'moderate' | 'at-risk';
}

export interface WeeklyAttendanceTrend {
  dayName: string;
  dateKey: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalMarked: number;
  percentage: number;
}

export interface AttendanceStatusDistribution {
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  presentPercent: number;
  latePercent: number;
  absentPercent: number;
  excusedPercent: number;
}

export interface TodayClassSession {
  id: string;
  classId: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  room: string;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  attendanceCompleted: boolean;
}

export interface UpcomingAgendaEvent {
  id: string;
  title: string;
  categoryName: string;
  categoryCode: string;
  accentKey: AgendaCategoryAccentKey;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  location: string | null;
  subjectCode: string | null;
  isCompleted: boolean;
}

export interface RecentActivityItem {
  id: string;
  type: 'attendance' | 'recitation' | 'agenda' | 'class' | 'student';
  title: string;
  description: string;
  timestamp: string;
  targetLink: string;
}
