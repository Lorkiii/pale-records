// Defines page-memory attendance records and the stable PALE status vocabulary.
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

export interface SelectedProofMetadata {
  file: File;
  name: string;
  type: string;
  size: number;
}

export interface AttendanceDraftRecord {
  status: AttendanceStatusCode | null;
  remarks: string;
  proof: SelectedProofMetadata | null;
}

export type AttendanceRecordsByStudentId = Record<string, AttendanceDraftRecord>;

export interface AttendanceDateDraft {
  date: string;
  records: AttendanceRecordsByStudentId;
  savedRecords: AttendanceRecordsByStudentId | null;
}
