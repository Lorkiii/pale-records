// Validates class identifiers and normalizes class write input at the HTTP boundary.
import { z } from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const CLASS_SCHEDULE_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

interface ClassDateRangeInput {
  startDate?: string;
  endDate?: string;
}

interface ClassRefinementContext {
  addIssue: (issue: {
    code: "custom";
    path: Array<string | number>;
    message: string;
  }) => void;
}

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

export const classScheduleInputSchema = z
  .strictObject({
    dayOfWeek: z
      .number({ error: "Weekday is required" })
      .int("Weekday must be a whole number")
      .min(1, "Weekday must be between 1 and 7")
      .max(7, "Weekday must be between 1 and 7"),
    startTime: z
      .string({ error: "Start time is required" })
      .regex(CLASS_SCHEDULE_TIME_PATTERN, "Start time must use the HH:mm 24-hour format"),
    endTime: z
      .string({ error: "End time is required" })
      .regex(CLASS_SCHEDULE_TIME_PATTERN, "End time must use the HH:mm 24-hour format"),
  })
  .superRefine((schedule, context) => {
    // Lexical ordering is chronological after strict HH:mm normalization.
    if (
      CLASS_SCHEDULE_TIME_PATTERN.test(schedule.startTime) &&
      CLASS_SCHEDULE_TIME_PATTERN.test(schedule.endTime) &&
      schedule.endTime <= schedule.startTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be later than start time",
      });
    }
  });

const classSchedulesSchema = z
  .array(classScheduleInputSchema)
  .max(7, "A class can have at most seven weekly schedule rows")
  .superRefine((schedules, context) => {
    const firstIndexByWeekday = new Map<number, number>();

    schedules.forEach((schedule, index) => {
      const firstIndex = firstIndexByWeekday.get(schedule.dayOfWeek);

      if (firstIndex === undefined) {
        firstIndexByWeekday.set(schedule.dayOfWeek, index);
        return;
      }

      context.addIssue({
        code: "custom",
        path: [firstIndex, "dayOfWeek"],
        message: "Each weekday can be scheduled only once",
      });
      context.addIssue({
        code: "custom",
        path: [index, "dayOfWeek"],
        message: "Each weekday can be scheduled only once",
      });
    });
  })
  .transform((schedules) =>
    [...schedules].sort((first, second) => first.dayOfWeek - second.dayOfWeek),
  );

const classInputShape = {
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
};

// Reports the shared class calendar ordering rule against the end-date field.
function validateClassDateRange(
  input: ClassDateRangeInput,
  context: ClassRefinementContext,
) {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be on or after the start date",
    });
  }
}

export const createClassSchema = z
  .strictObject({
    ...classInputShape,
    schedules: classSchedulesSchema.optional().default([]),
  })
  .superRefine(validateClassDateRange);

export const updateClassSchema = z
  .strictObject({
    ...classInputShape,
    schedules: classSchedulesSchema.optional(),
  })
  .superRefine(validateClassDateRange);

export const classIdParamsSchema = z.strictObject({
  classId: z.string().uuid("Class ID must be a valid UUID"),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ClassScheduleInput = z.infer<typeof classScheduleInputSchema>;
export type ClassIdParams = z.infer<typeof classIdParamsSchema>;
