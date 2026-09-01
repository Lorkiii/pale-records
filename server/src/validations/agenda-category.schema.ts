// Validates and normalizes authenticated Agenda category mutations.
import { z } from "zod";

export const agendaCategoryAccentKeySchema = z.enum([
  "SIGNAL_RED",
  "SIGNAL_ORANGE",
  "SIGNAL_AMBER",
  "SIGNAL_YELLOW",
  "SIGNAL_GOLD",
  "SIGNAL_OCHRE",
  "SIGNAL_MUSTARD",
  "SIGNAL_EMERALD",
  "SIGNAL_TEAL",
  "SIGNAL_BLUE",
  "SIGNAL_PURPLE",
  "SIGNAL_ROSE",
  "INK",
  "INK_MUTED",
]);

const categoryNameSchema = z
  .string({ error: "Category name is required" })
  .trim()
  .min(1, "Category name is required")
  .max(120, "Category name must be at most 120 characters");

const categoryShortCodeSchema = z
  .string({ error: "Short code is required" })
  .trim()
  .min(1, "Short code is required")
  .max(12, "Short code must be at most 12 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Short code may contain only letters, numbers, hyphens, and underscores",
  )
  .transform((value) => value.toUpperCase());

const optionalCategoryDescriptionSchema = z
  .preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(500, "Description must be at most 500 characters").nullable().optional(),
  )
  .transform((value) => value ?? null);

const categoryDescriptionSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(500, "Description must be at most 500 characters").nullable(),
);

export const createAgendaCategorySchema = z.strictObject({
  name: categoryNameSchema,
  shortCode: categoryShortCodeSchema,
  accentKey: agendaCategoryAccentKeySchema,
  description: optionalCategoryDescriptionSchema,
});

export const updateAgendaCategorySchema = z.strictObject({
  name: categoryNameSchema,
  shortCode: categoryShortCodeSchema,
  accentKey: agendaCategoryAccentKeySchema,
  description: categoryDescriptionSchema,
  isActive: z.boolean({ error: "Active status is required" }),
});

export const agendaCategoryIdParamsSchema = z.strictObject({
  categoryId: z.string().uuid("Agenda category ID must be a valid UUID"),
});

export type AgendaCategoryAccentKeyCode = z.infer<typeof agendaCategoryAccentKeySchema>;
export type CreateAgendaCategoryInput = z.infer<typeof createAgendaCategorySchema>;
export type UpdateAgendaCategoryInput = z.infer<typeof updateAgendaCategorySchema>;
export type AgendaCategoryIdParams = z.infer<typeof agendaCategoryIdParamsSchema>;
