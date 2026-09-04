// Defines the fixed printable Attendance geometry shared by PDF export and scan extraction.
export const ATTENDANCE_TEMPLATE_PAGE_WIDTH_MM = 297;
export const ATTENDANCE_TEMPLATE_PAGE_HEIGHT_MM = 210;
export const ATTENDANCE_TEMPLATE_PAGE_MARGIN_MM = 10;
export const ATTENDANCE_TEMPLATE_TABLE_TOP_MM = 47;
export const ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM = 9;
export const ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM = 9;
export const ATTENDANCE_TEMPLATE_STUDENT_COLUMN_WIDTH_MM = 84;
export const ATTENDANCE_TEMPLATE_STATUS_COLUMN_WIDTH_MM = 35;
export const ATTENDANCE_TEMPLATE_REMARKS_COLUMN_WIDTH_MM = 158;
export const ATTENDANCE_TEMPLATE_ROWS_PER_PAGE = 15;
export const ATTENDANCE_TEMPLATE_REGISTRATION_MARK_SIZE_MM = 2;

export const ATTENDANCE_TEMPLATE_REGISTRATION_MARK_CENTERS_MM = [
  { x: 11, y: 6 },
  { x: 286, y: 6 },
  { x: 11, y: 198 },
  { x: 286, y: 198 },
] as const;

export interface AttendanceTemplatePageRowRange {
  firstRowNumber: number;
  lastRowNumber: number;
}

// Returns the exact roster rows represented by one one-based physical page.
export function getAttendanceTemplatePageRowRange(
  pageNumber: number,
  studentCount: number,
): AttendanceTemplatePageRowRange {
  const firstRowNumber = ((pageNumber - 1) * ATTENDANCE_TEMPLATE_ROWS_PER_PAGE) + 1;
  return {
    firstRowNumber,
    lastRowNumber: Math.min(
      studentCount,
      firstRowNumber + ATTENDANCE_TEMPLATE_ROWS_PER_PAGE - 1,
    ),
  };
}

// Calculates the expected complete page set for one selected-date roster.
export function getAttendanceTemplatePageCount(studentCount: number) {
  return Math.max(1, Math.ceil(studentCount / ATTENDANCE_TEMPLATE_ROWS_PER_PAGE));
}
