// Defines the enabled dashboard destinations shared by the shell and sidebar.
export type DashboardNavigationIconName =
  | 'overview'
  | 'class'
  | 'student'
  | 'attendance'
  | 'activity'
  | 'agenda';

export interface DashboardNavigationItem {
  id: DashboardNavigationIconName;
  label: string;
  to: string;
}

export const DASHBOARD_NAVIGATION: DashboardNavigationItem[] = [
  { id: 'overview', label: 'Overview', to: '/dashboard' },
  { id: 'class', label: 'Class', to: '/dashboard/classes' },
  { id: 'student', label: 'Students', to: '/dashboard/students' },
  { id: 'attendance', label: 'Attendance', to: '/dashboard/attendance' },
  { id: 'activity', label: 'Activity', to: '/dashboard/activity' },
  { id: 'agenda', label: 'Agenda', to: '/dashboard/agenda' },
];
