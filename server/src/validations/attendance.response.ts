// Defines safe Attendance session, roster, success, and expected error response contracts.
import { z } from "zod";

import {
  ATTENDANCE_DATE_PATTERN,
  ATTENDANCE_REMARKS_MAX_LENGTH,
  attendanceStatusCodeSchema,
} from "./attendance.schema.js";
import { CLASS_SCHEDULE_TIME_PATTERN } from "./class.schema.js";

export const attendanceStudentRecordSchema = z.strictObject({
  id: z.string().uuid(),
  studentNo: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
});

export const attendanceRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    student: attendanceStudentRecordSchema,
    status: attendanceStatusCodeSchema.nullable(),
    remarks: z.string().max(ATTENDANCE_REMARKS_MAX_LENGTH).nullable(),
  })
  .superRefine((record, context) => {
    if (record.status === "E" && !record.remarks?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Excused records require remarks",
      });
    } else if (record.status !== "E" && record.remarks !== null) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Only Excused records may include remarks",
      });
    }
  });

const attendanceRecordsSchema = z
  .array(attendanceRecordSchema)
  .min(1)
  .superRefine((records, context) => {
    const studentIds = new Set<string>();

    records.forEach((record, index) => {
      if (studentIds.has(record.student.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "student", "id"],
          message: "Each saved student must appear exactly once",
        });
      }
      studentIds.add(record.student.id);
    });
  });

export const attendanceSessionRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    classId: z.string().uuid(),
    classScheduleId: z.string().uuid().nullable(),
    sessionDate: z.string().regex(ATTENDANCE_DATE_PATTERN),
    startTime: z.string().regex(CLASS_SCHEDULE_TIME_PATTERN).nullable(),
    endTime: z.string().regex(CLASS_SCHEDULE_TIME_PATTERN).nullable(),
    records: attendanceRecordsSchema,
  })
  .superRefine((session, context) => {
    if ((session.startTime === null) !== (session.endTime === null)) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Session snapshot times must both be present or both be null",
      });
    } else if (
      session.startTime !== null &&
      session.endTime !== null &&
      session.endTime <= session.startTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Session end time must be later than start time",
      });
    }
  });

export type AttendanceStudentRecord = z.infer<typeof attendanceStudentRecordSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceSessionRecord = z.infer<typeof attendanceSessionRecordSchema>;

export const attendanceSessionResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    session: attendanceSessionRecordSchema,
  }),
});

export const attendanceSessionListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    sessions: z.array(attendanceSessionRecordSchema).max(31),
  }),
});

export const attendanceSessionDeleteResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    sessionId: z.string().uuid(),
  }),
});

// Builds a strict expected error schema without exposing internal exception details.
function attendanceErrorResponseSchema<Code extends string, Message extends string>(
  code: Code,
  message: Message,
) {
  return z.strictObject({
    success: z.literal(false),
    error: z.strictObject({
      code: z.literal(code),
      message: z.literal(message),
    }),
  });
}

export const attendanceClassNotFoundResponseSchema = attendanceErrorResponseSchema(
  "CLASS_NOT_FOUND",
  "Class was not found.",
);
export const attendanceClassArchivedResponseSchema = attendanceErrorResponseSchema(
  "CLASS_ARCHIVED",
  "Archived classes cannot create attendance sessions.",
);
export const attendanceClassHasNoStudentsResponseSchema = attendanceErrorResponseSchema(
  "CLASS_HAS_NO_STUDENTS",
  "The class has no enrolled students.",
);
export const attendanceSessionExistsResponseSchema = attendanceErrorResponseSchema(
  "ATTENDANCE_SESSION_EXISTS",
  "Attendance already exists for this class and date.",
);
export const attendanceSessionNotFoundResponseSchema = attendanceErrorResponseSchema(
  "ATTENDANCE_SESSION_NOT_FOUND",
  "Attendance session was not found.",
);
export const attendanceRosterMismatchResponseSchema = attendanceErrorResponseSchema(
  "ATTENDANCE_ROSTER_MISMATCH",
  "The submitted roster does not match the saved attendance session.",
);
export const attendanceStudentDuplicateResponseSchema = attendanceErrorResponseSchema(
  "ATTENDANCE_STUDENT_DUPLICATE",
  "Submit each student exactly once.",
);
