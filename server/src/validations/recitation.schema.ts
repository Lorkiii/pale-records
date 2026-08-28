// Validates Recitation identifiers, date-only values, month queries, marks, and complete rosters.
import { z } from "zod";

export const RECITATION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Confirms a normalized YYYY-MM-DD value represents a real UTC calendar date.
function isRealCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const recitationDateSchema = z
  .string({ error: "Recitation date is required" })
  .regex(RECITATION_DATE_PATTERN, "Use the YYYY-MM-DD date format")
  .refine(isRealCalendarDate, "Enter a valid calendar date");

export const recitationMarkSchema = z.enum(["CHECK", "X"]);

export const recitationRecordInputSchema = z.strictObject({
  studentId: z.string().uuid("Student ID must be a valid UUID"),
  mark: recitationMarkSchema.nullable(),
});

export const createRecitationSessionSchema = z.strictObject({
  sessionDate: recitationDateSchema,
});

const recitationYearQuerySchema = z
  .string({ error: "Year is required" })
  .regex(/^\d{4}$/, "Year must be a four-digit number")
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(2000, "Year must be between 2000 and 2100")
      .max(2100, "Year must be between 2000 and 2100"),
  );

const recitationMonthQueryValueSchema = z
  .string({ error: "Month is required" })
  .regex(/^\d{1,2}$/, "Month must be between 1 and 12")
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(1, "Month must be between 1 and 12")
      .max(12, "Month must be between 1 and 12"),
  );

export const listRecitationSessionsQuerySchema = z.strictObject({
  year: recitationYearQuerySchema,
  month: recitationMonthQueryValueSchema,
});

export const saveRecitationRecordsSchema = z.strictObject({
  records: z
    .array(recitationRecordInputSchema)
    .max(100, "Submit at most 100 recitation records")
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

export const recitationClassIdParamsSchema = z.strictObject({
  classId: z.string().uuid("Class ID must be a valid UUID"),
});

export const recitationSessionIdParamsSchema = z.strictObject({
  sessionId: z.string().uuid("Recitation session ID must be a valid UUID"),
});

export type RecitationMarkCode = z.infer<typeof recitationMarkSchema>;
export type RecitationRecordInput = z.infer<typeof recitationRecordInputSchema>;
export type CreateRecitationSessionInput = z.infer<typeof createRecitationSessionSchema>;
export type ListRecitationSessionsQuery = z.infer<typeof listRecitationSessionsQuerySchema>;
export type SaveRecitationRecordsInput = z.infer<typeof saveRecitationRecordsSchema>;
export type RecitationClassIdParams = z.infer<typeof recitationClassIdParamsSchema>;
export type RecitationSessionIdParams = z.infer<typeof recitationSessionIdParamsSchema>;
