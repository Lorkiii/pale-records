// Validates Attendance identifiers, calendar dates, PALE codes, and complete roster writes.
import { z } from "zod";

export const ATTENDANCE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ATTENDANCE_REMARKS_MAX_LENGTH = 1_000;

// Confirms a normalized YYYY-MM-DD value represents a real UTC calendar date.
function isRealCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const attendanceDateSchema = z
  .string({ error: "Attendance date is required" })
  .regex(ATTENDANCE_DATE_PATTERN, "Use the YYYY-MM-DD date format")
  .refine(isRealCalendarDate, "Enter a valid calendar date");

export const attendanceStatusCodeSchema = z.enum(["P", "A", "L", "E"]);

const normalizedRemarksSchema = z
  .preprocess(
    (value) => typeof value === "string" ? value.trim() || null : value,
    z
      .string()
      .max(
        ATTENDANCE_REMARKS_MAX_LENGTH,
        `Remarks must be at most ${ATTENDANCE_REMARKS_MAX_LENGTH} characters`,
      )
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

export const attendanceRecordInputSchema = z
  .strictObject({
    studentId: z.string().uuid("Student ID must be a valid UUID"),
    status: attendanceStatusCodeSchema.nullable(),
    remarks: normalizedRemarksSchema,
  })
  .superRefine((record, context) => {
    if (record.status === "E" && record.remarks === null) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "A remark is required when attendance is Excused",
      });
    } else if (record.status !== "E" && record.remarks !== null) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Remarks are allowed only when attendance is Excused",
      });
    }
  });

export const createAttendanceSessionSchema = z.strictObject({
  sessionDate: attendanceDateSchema,
});

export const saveAttendanceRecordsSchema = z.strictObject({
  records: z
    .array(attendanceRecordInputSchema)
    .min(1, "Submit at least one attendance record")
    .max(100, "Submit at most 100 attendance records")
    .superRefine((records, context) => {
      const firstIndexByStudentId = new Map<string, number>();

      records.forEach((record, index) => {
        const firstIndex = firstIndexByStudentId.get(record.studentId);

        if (firstIndex === undefined) {
          firstIndexByStudentId.set(record.studentId, index);
          return;
        }

        for (const duplicateIndex of [firstIndex, index]) {
          context.addIssue({
            code: "custom",
            path: [duplicateIndex, "studentId"],
            message: "Submit each student exactly once",
          });
        }
      });
    }),
});

export const attendanceClassIdParamsSchema = z.strictObject({
  classId: z.string().uuid("Class ID must be a valid UUID"),
});

export const attendanceSessionIdParamsSchema = z.strictObject({
  sessionId: z.string().uuid("Attendance session ID must be a valid UUID"),
});

export type AttendanceStatusCode = z.infer<typeof attendanceStatusCodeSchema>;
export type AttendanceRecordInput = z.infer<typeof attendanceRecordInputSchema>;
export type CreateAttendanceSessionInput = z.infer<typeof createAttendanceSessionSchema>;
export type SaveAttendanceRecordsInput = z.infer<typeof saveAttendanceRecordsSchema>;
export type AttendanceClassIdParams = z.infer<typeof attendanceClassIdParamsSchema>;
export type AttendanceSessionIdParams = z.infer<typeof attendanceSessionIdParamsSchema>;
