// Defines validated Recitation API records and separate local working snapshots.
export type RecitationMarkCode = 'CHECK' | 'X';

export interface RecitationStudentRecord {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
}

export interface RecitationRecord {
  id: string | null;
  student: RecitationStudentRecord;
  mark: RecitationMarkCode | null;
}

export interface RecitationSessionRecord {
  id: string;
  classId: string;
  sessionDate: string;
  isRosterInitialized: boolean;
  records: RecitationRecord[];
}

export interface SaveRecitationRecordInput {
  studentId: string;
  mark: RecitationMarkCode | null;
}

export interface WorkingRecitationRecord {
  id: string | null;
  student: RecitationStudentRecord;
  mark: RecitationMarkCode | null;
}

export type WorkingRecitationRecordsByStudentId = Record<
  string,
  WorkingRecitationRecord
>;

export interface RecitationSessionDraft {
  id: string;
  classId: string;
  sessionDate: string;
  isRosterInitialized: boolean;
  records: WorkingRecitationRecordsByStudentId;
  savedRecords: WorkingRecitationRecordsByStudentId;
}

export type RecitationUndoSnapshot = WorkingRecitationRecordsByStudentId;
