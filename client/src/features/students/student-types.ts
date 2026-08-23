// Defines the schema-aligned student values and page-local record shape used by the student workspace.
export interface StudentInput {
  classId: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
}

export interface StudentRecord extends StudentInput {
  clientId: string;
}

export type StudentFieldName = keyof StudentInput;
