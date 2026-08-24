// Defines the student creation contract and safe persisted records used by the student workspace.
export interface CreateStudentInput {
  classIds: string[];
  studentNo?: string;
  firstName: string;
  lastName: string;
}

export interface StudentClassRecord {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
}

export interface StudentRecord {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
  classes: StudentClassRecord[];
}

export type StudentTextFieldName = 'studentNo' | 'firstName' | 'lastName';
