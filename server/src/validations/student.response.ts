// Defines the safe student records and expected create/list API response contracts.
import { z } from "zod";

export const studentClassRecordSchema = z.strictObject({
  id: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string().nullable(),
  section: z.string().nullable(),
});

export const studentRecordSchema = z.strictObject({
  id: z.string().uuid(),
  studentNo: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  classes: z.array(studentClassRecordSchema),
});

export type StudentClassRecord = z.infer<typeof studentClassRecordSchema>;
export type StudentRecord = z.infer<typeof studentRecordSchema>;

export const studentListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    students: z.array(studentRecordSchema),
  }),
});

export const studentCreateResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    student: studentRecordSchema,
  }),
});

export const studentClassSelectionUnavailableResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("CLASS_SELECTION_UNAVAILABLE"),
    message: z.literal("One or more selected classes are unavailable."),
    details: z.strictObject({
      fieldErrors: z.strictObject({
        classIds: z.array(z.string()),
      }),
    }),
  }),
});

export const studentNumberExistsResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("STUDENT_NUMBER_EXISTS"),
    message: z.literal("A student with this student number already exists."),
    details: z.strictObject({
      fieldErrors: z.strictObject({
        studentNo: z.array(z.string()),
      }),
    }),
  }),
});
