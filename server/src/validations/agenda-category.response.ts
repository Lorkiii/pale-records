// Defines safe Agenda category records, mutation envelopes, and expected errors.
import { z } from "zod";

import { agendaCategoryAccentKeySchema } from "./agenda-category.schema.js";

export const AGENDA_MAX_CATEGORIES = 100;

export const agendaCategoryRecordSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).refine((value) => value.trim().length > 0),
  shortCode: z.string().min(1).max(12).regex(/^[A-Z0-9_-]+$/),
  accentKey: agendaCategoryAccentKeySchema,
  description: z.string().max(500).nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export type AgendaCategoryRecord = z.infer<typeof agendaCategoryRecordSchema>;

export const agendaCategoryListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    categories: z.array(agendaCategoryRecordSchema).max(AGENDA_MAX_CATEGORIES),
  }),
});

export const agendaCategoryMutationResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({ category: agendaCategoryRecordSchema }),
});

export const agendaCategoryDeleteResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    categoryId: z.string().uuid(),
    result: z.enum(["DELETED", "DEACTIVATED"]),
  }),
});

export const agendaCategoryRestoreResponseSchema = agendaCategoryListResponseSchema;

export const agendaCategoryNotFoundResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("AGENDA_CATEGORY_NOT_FOUND"),
    message: z.literal("Agenda category was not found."),
  }),
});

export const agendaCategoryShortCodeConflictResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("AGENDA_CATEGORY_SHORT_CODE_CONFLICT"),
    message: z.literal("That Agenda category short code is already in use."),
    details: z.strictObject({
      fieldErrors: z.strictObject({
        shortCode: z.array(z.string()).min(1),
      }),
      formErrors: z.array(z.string()),
    }),
  }),
});

export const agendaCategoryLimitResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("AGENDA_CATEGORY_LIMIT_REACHED"),
    message: z.literal("Agenda categories are limited to 100 per account."),
  }),
});
