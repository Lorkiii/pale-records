// Defines persisted Attendance API records and the separate local working snapshot model.
export type AttendanceStatusCode = 'P' | 'A' | 'L' | 'E';

export const ATTENDANCE_STATUS_ORDER: readonly AttendanceStatusCode[] = [
  'P',
  'A',
  'L',
  'E',
];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusCode, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  E: 'Excused',
};

export const ATTENDANCE_REMARKS_MAX_LENGTH = 1_000;

export interface AttendanceStudentRecord {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
}

export interface AttendanceRecord {
  id: string;
  student: AttendanceStudentRecord;
  status: AttendanceStatusCode | null;
  remarks: string | null;
}

export interface AttendanceSessionRecord {
  id: string;
  classId: string;
  classScheduleId: string | null;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  records: AttendanceRecord[];
}

export interface SaveAttendanceRecordInput {
  studentId: string;
  status: AttendanceStatusCode | null;
  remarks: string | null;
}

export interface WorkingAttendanceRecord {
  id: string;
  student: AttendanceStudentRecord;
  status: AttendanceStatusCode | null;
  remarks: string;
}

export type WorkingAttendanceRecordsByStudentId = Record<string, WorkingAttendanceRecord>;

export interface AttendanceSessionDraft {
  id: string;
  classId: string;
  classScheduleId: string | null;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  records: WorkingAttendanceRecordsByStudentId;
  savedRecords: WorkingAttendanceRecordsByStudentId;
}
