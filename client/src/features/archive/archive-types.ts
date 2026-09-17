// Defines the public archived records displayed by the Class and Student workspaces.
import type { StudentRecord } from '../students/student-types';

export interface ArchivedClassRecord {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
  schoolYear: string | null;
  semester: string | null;
  archivedAt: string;
  canDelete: boolean;
}

export interface ArchivedStudentRecord extends StudentRecord {
  archivedAt: string;
  canDelete: boolean;
}

export interface ArchivePage<RecordType> {
  records: RecordType[];
  hasMore: boolean;
}
