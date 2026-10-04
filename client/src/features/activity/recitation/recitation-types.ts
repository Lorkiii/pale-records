// Defines validated Recitation API records and separate local working snapshots.
// Null means a historical Check with an unknown count; zero displays as blank.
export type RecitationCount = number | null;

export interface RecitationStudentRecord {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
}

export interface RecitationRecord {
  id: string | null;
  student: RecitationStudentRecord;
  count: RecitationCount;
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
  count: RecitationCount;
}

export interface WorkingRecitationRecord {
  id: string | null;
  student: RecitationStudentRecord;
  count: RecitationCount;
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
