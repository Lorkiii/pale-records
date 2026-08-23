// Validates class identifiers and normalizes class write input at the HTTP boundary.
import { z } from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Builds an optional string schema that trims input and removes blank values.
function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(maxLength).optional(),
  );
}

const optionalDateOnly = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z
    .string()
    .regex(DATE_ONLY_PATTERN, "Use the YYYY-MM-DD date format")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "Enter a valid calendar date")
    .optional(),
);

export const createClassSchema = z
  .strictObject({
    subjectName: z
      .string({ error: "Subject name is required" })
      .trim()
      .min(1, "Subject name is required")
      .max(120, "Subject name must be at most 120 characters"),
    subjectCode: optionalTrimmedString(32),
    section: optionalTrimmedString(64),
    schoolYear: optionalTrimmedString(32),
    semester: optionalTrimmedString(32),
    teacher: optionalTrimmedString(120),
    room: optionalTrimmedString(64),
    startDate: optionalDateOnly,
    endDate: optionalDateOnly,
  })
  .superRefine((input, context) => {
    // Assigns a range-ordering error directly to the end-date form field.
    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    }
  });

export const updateClassSchema = createClassSchema;

export const classIdParamsSchema = z.strictObject({
  classId: z.string().uuid("Class ID must be a valid UUID"),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ClassIdParams = z.infer<typeof classIdParamsSchema>;
