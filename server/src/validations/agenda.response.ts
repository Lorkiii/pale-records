// Defines strict safe Agenda records, bounded success envelopes, and expected error responses.
import { z } from "zod";

import {
  AGENDA_TIME_PATTERN,
  agendaDateSchema,
  agendaEventTypeSchema,
} from "./agenda.schema.js";

export const AGENDA_MAX_EVENTS = 500;

export const agendaEventRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    title: z.string().min(1).max(160).refine((value) => value.trim().length > 0),
    description: z.string().max(2000).nullable(),
    eventDate: agendaDateSchema,
    startTime: z.string().regex(AGENDA_TIME_PATTERN).nullable(),
    endTime: z.string().regex(AGENDA_TIME_PATTERN).nullable(),
    isAllDay: z.boolean(),
    eventType: agendaEventTypeSchema,
    classId: z.string().uuid().nullable(),
    location: z.string().max(160).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((event, context) => {
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
