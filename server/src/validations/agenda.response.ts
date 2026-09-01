// Defines strict safe Agenda event records, success envelopes, and expected errors.
import { z } from "zod";

import {
  AGENDA_TIME_PATTERN,
  agendaDateSchema,
} from "./agenda.schema.js";
import { agendaCategoryAccentKeySchema } from "./agenda-category.schema.js";

export const AGENDA_MAX_EVENTS = 500;

export const agendaEventCategorySchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).refine((value) => value.trim().length > 0),
  shortCode: z.string().min(1).max(12).regex(/^[A-Z0-9_-]+$/),
  accentKey: agendaCategoryAccentKeySchema,
  isActive: z.boolean(),
});

export const agendaEventRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    title: z.string().min(1).max(160).refine((value) => value.trim().length > 0),
    description: z.string().max(2000).nullable(),
    eventDate: agendaDateSchema,
    startTime: z.string().regex(AGENDA_TIME_PATTERN).nullable(),
    endTime: z.string().regex(AGENDA_TIME_PATTERN).nullable(),
    isAllDay: z.boolean(),
    categoryId: z.string().uuid(),
    category: agendaEventCategorySchema,
    classId: z.string().uuid().nullable(),
    location: z.string().max(160).nullable(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((event, context) => {
    if (event.category.id !== event.categoryId) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Category summary must match categoryId",
      });
    }

    if (event.isAllDay && (event.startTime !== null || event.endTime !== null)) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "All-day events cannot include start or end times",
      });
    }

    if (
      event.startTime !== null &&
      event.endTime !== null &&
      event.endTime <= event.startTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be later than start time",
      });
    }
  });

export type AgendaEventRecord = z.infer<typeof agendaEventRecordSchema>;

export const agendaEventListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    events: z.array(agendaEventRecordSchema).max(AGENDA_MAX_EVENTS),
  }),
});

export const agendaEventCreateResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    event: agendaEventRecordSchema,
  }),
});

export const agendaEventUpdateResponseSchema = agendaEventCreateResponseSchema;
export const agendaEventCompletionResponseSchema = agendaEventCreateResponseSchema;

export const agendaEventImportResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    event: agendaEventRecordSchema,
    imported: z.boolean(),
    classAssociationRemoved: z.boolean(),
  }),
});

export const agendaEventDeleteResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    eventId: z.string().uuid(),
  }),
});

// Builds strict expected errors without exposing internal database details.
function agendaErrorResponseSchema<Code extends string, Message extends string>(
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

export const agendaEventNotFoundResponseSchema = agendaErrorResponseSchema(
  "AGENDA_EVENT_NOT_FOUND",
  "Agenda event was not found.",
);

export const agendaClassNotFoundResponseSchema = agendaErrorResponseSchema(
  "AGENDA_CLASS_NOT_FOUND",
  "Associated class was not found.",
);

export const agendaCategoryUnavailableResponseSchema = agendaErrorResponseSchema(
  "AGENDA_CATEGORY_NOT_FOUND",
  "Agenda category was not found or is inactive.",
);
