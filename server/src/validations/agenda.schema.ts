// Validates Agenda identifiers, date ranges, category-based writes, and legacy imports.
import { z } from "zod";

export const AGENDA_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const AGENDA_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const AGENDA_MAX_RANGE_DAYS = 62;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// Confirms a normalized YYYY-MM-DD value represents a real UTC calendar date.
function isRealCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export const agendaDateSchema = z
  .string({ error: "Date is required" })
  .regex(AGENDA_DATE_PATTERN, "Use the YYYY-MM-DD date format")
  .refine(isRealCalendarDate, "Enter a valid calendar date");

export const legacyAgendaEventTypeSchema = z.enum([
  "EXAM",
  "ASSIGNMENT",
  "ACTIVITY",
  "HOLIDAY",
  "MEETING",
  "NOTE",
]);

// Trims optional text and represents omission or whitespace-only input as null.
function nullableTrimmedString(maxLength: number, maxLengthMessage: string) {
  return z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim() === ""
          ? null
          : value,
      z.string().trim().max(maxLength, maxLengthMessage).nullable().optional(),
    )
    .transform((value) => value ?? null);
}

const nullableTimeSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? null
        : value,
    z
      .string()
      .trim()
      .regex(AGENDA_TIME_PATTERN, "Time must use the HH:MM 24-hour format")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const nullableClassIdSchema = z
  .preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? null
        : value,
    z
      .string()
      .trim()
      .uuid("Class ID must be a valid UUID")
      .nullable()
      .optional(),
  )
  .transform((value) => value ?? null);

const agendaEventInputShape = {
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(160, "Title must be at most 160 characters"),
  description: nullableTrimmedString(
    2000,
    "Description must be at most 2000 characters",
  ),
  eventDate: agendaDateSchema,
  startTime: nullableTimeSchema,
  endTime: nullableTimeSchema,
  isAllDay: z.boolean({ error: "All-day status is required" }),
  classId: nullableClassIdSchema,
  location: nullableTrimmedString(
    160,
    "Location must be at most 160 characters",
  ),
};

type AgendaTimeInput = {
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
};

// Enforces the shared all-day and chronological rules after time normalization.
function validateAgendaTimes(
  input: AgendaTimeInput,
  context: z.RefinementCtx,
) {
  if (input.isAllDay && (input.startTime !== null || input.endTime !== null)) {
    context.addIssue({
      code: "custom",
      path: ["startTime"],
      message: "All-day events cannot include start or end times",
    });
  }

  if (
    input.startTime !== null &&
    input.endTime !== null &&
    input.endTime <= input.startTime
  ) {
    context.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "End time must be later than start time",
    });
  }
}

export const createAgendaEventSchema = z
  .strictObject({
    ...agendaEventInputShape,
    categoryId: z.string().uuid("Category ID must be a valid UUID"),
  })
  .superRefine(validateAgendaTimes);

export const updateAgendaEventSchema = z
  .strictObject({
    ...agendaEventInputShape,
    categoryId: z.string().uuid("Category ID must be a valid UUID"),
  })
  .superRefine(validateAgendaTimes);

export const importAgendaEventSchema = z
  .strictObject({
    legacyEventId: z
      .string({ error: "Legacy event ID is required" })
      .trim()
      .min(1, "Legacy event ID is required")
      .max(160, "Legacy event ID must be at most 160 characters"),
    ...agendaEventInputShape,
    eventType: legacyAgendaEventTypeSchema,
  })
  .superRefine(validateAgendaTimes);

export const agendaEventIdParamsSchema = z.strictObject({
  eventId: z.string().uuid("Agenda event ID must be a valid UUID"),
});

export const listAgendaEventsQuerySchema = z
  .strictObject({
    from: agendaDateSchema,
    to: agendaDateSchema,
  })
  .superRefine((query, context) => {
    if (query.from > query.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "To date must be on or after from date",
      });
      return;
    }

    const fromTime = new Date(`${query.from}T00:00:00.000Z`).getTime();
    const toTime = new Date(`${query.to}T00:00:00.000Z`).getTime();
    const inclusiveDayCount = (toTime - fromTime) / MILLISECONDS_PER_DAY + 1;

    if (inclusiveDayCount > AGENDA_MAX_RANGE_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: `Date range must span at most ${AGENDA_MAX_RANGE_DAYS} days`,
      });
    }
  });

export type LegacyAgendaEventTypeCode = z.infer<typeof legacyAgendaEventTypeSchema>;
export type CreateAgendaEventInput = z.infer<typeof createAgendaEventSchema>;
export type UpdateAgendaEventInput = z.infer<typeof updateAgendaEventSchema>;
export type ImportAgendaEventInput = z.infer<typeof importAgendaEventSchema>;
export type AgendaEventIdParams = z.infer<typeof agendaEventIdParamsSchema>;
export type ListAgendaEventsQuery = z.infer<typeof listAgendaEventsQuerySchema>;
