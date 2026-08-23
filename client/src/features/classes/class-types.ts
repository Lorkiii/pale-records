// Defines the class data shared by the class API, form, and directory views.
export interface ClassRecord {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
  schoolYear: string | null;
  semester: string | null;
  teacher: string | null;
  room: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface CreateClassInput {
  subjectName: string;
  subjectCode?: string;
  section?: string;
  schoolYear?: string;
  semester?: string;
  teacher?: string;
  room?: string;
  startDate?: string;
  endDate?: string;
}

export type ClassFieldName = keyof CreateClassInput;
