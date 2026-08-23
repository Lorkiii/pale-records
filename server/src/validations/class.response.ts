// Defines the safe class records returned by class API endpoints.
import { z } from "zod";

const nullableDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const classRecordSchema = z.strictObject({
  id: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string().nullable(),
  section: z.string().nullable(),
  schoolYear: z.string().nullable(),
  semester: z.string().nullable(),
  teacher: z.string().nullable(),
  room: z.string().nullable(),
  startDate: nullableDateOnlySchema,
  endDate: nullableDateOnlySchema,
});

export type ClassRecord = z.infer<typeof classRecordSchema>;

export const classListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    classes: z.array(classRecordSchema),
  }),
});

export const classCreateResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    class: classRecordSchema,
  }),
});

export const classUpdateResponseSchema = classCreateResponseSchema;

export const classArchiveResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    classId: z.string().uuid(),
  }),
});

export const classNotFoundResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("CLASS_NOT_FOUND"),
    message: z.literal("Class was not found."),
  }),
});
