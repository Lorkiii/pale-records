// Defines strict safe Recitation session, roster, success, and expected error responses.
import { z } from "zod";

import {
  recitationDateSchema,
  recitationMarkSchema,
} from "./recitation.schema.js";

export const recitationStudentRecordSchema = z.strictObject({
  id: z.string().uuid(),
  studentNo: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
});

export const recitationRecordSchema = z.strictObject({
  id: z.string().uuid().nullable(),
  student: recitationStudentRecordSchema,
  mark: recitationMarkSchema.nullable(),
});

const recitationRecordsSchema = z
  .array(recitationRecordSchema)
  .max(100)
  .superRefine((records, context) => {
    const studentIds = new Set<string>();

    records.forEach((record, index) => {
      if (studentIds.has(record.student.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "student", "id"],
          message: "Each roster student must appear exactly once",
        });
      }
      studentIds.add(record.student.id);
    });
  });

export const recitationSessionRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    classId: z.string().uuid(),
    sessionDate: recitationDateSchema,
    isRosterInitialized: z.boolean(),
    records: recitationRecordsSchema,
  })
  .superRefine((session, context) => {
    session.records.forEach((record, index) => {
      if (session.isRosterInitialized && record.id === null) {
        context.addIssue({
          code: "custom",
          path: ["records", index, "id"],
          message: "Saved roster records require database identifiers",
        });
      } else if (
        !session.isRosterInitialized &&
        (record.id !== null || record.mark !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["records", index],
          message: "Draft roster records must remain unpersisted and unmarked",
        });
      }
    });
  });

export type RecitationStudentRecord = z.infer<typeof recitationStudentRecordSchema>;
export type RecitationRecord = z.infer<typeof recitationRecordSchema>;
export type RecitationSessionRecord = z.infer<typeof recitationSessionRecordSchema>;

export const recitationSessionResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    session: recitationSessionRecordSchema,
  }),
});

export const recitationSessionListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    sessions: z.array(recitationSessionRecordSchema).max(31),
  }),
});

// Builds strict expected errors without exposing internal exception details.
function recitationErrorResponseSchema<Code extends string, Message extends string>(
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

export const recitationClassNotFoundResponseSchema = recitationErrorResponseSchema(
  "CLASS_NOT_FOUND",
  "Class was not found.",
);
export const recitationClassArchivedResponseSchema = recitationErrorResponseSchema(
  "CLASS_ARCHIVED",
  "Archived classes cannot create recitation sessions.",
);
export const recitationSessionExistsResponseSchema = recitationErrorResponseSchema(
  "RECITATION_SESSION_EXISTS",
  "Recitation already exists for this class and date.",
);
export const recitationSessionNotFoundResponseSchema = recitationErrorResponseSchema(
  "RECITATION_SESSION_NOT_FOUND",
  "Recitation session was not found.",
);
export const recitationRosterMismatchResponseSchema = recitationErrorResponseSchema(
  "RECITATION_ROSTER_MISMATCH",
  "The submitted roster does not match this recitation session. Reload and review the roster.",
);
export const recitationStudentDuplicateResponseSchema = recitationErrorResponseSchema(
  "RECITATION_STUDENT_DUPLICATE",
  "Submit each student exactly once.",
);
