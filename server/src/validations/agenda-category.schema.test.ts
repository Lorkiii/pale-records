// Verifies strict Agenda category validation, normalization, and safe response records.
import assert from "node:assert/strict";
import test from "node:test";

import {
  agendaCategoryIdParamsSchema,
  createAgendaCategorySchema,
  updateAgendaCategorySchema,
} from "./agenda-category.schema.js";
import {
  agendaCategoryDeleteResponseSchema,
  agendaCategoryListResponseSchema,
  agendaCategoryRecordSchema,
} from "./agenda-category.response.js";

const categoryId = "805a2580-d0b5-48a8-8eb3-9356e464b838";

const publicCategory = {
  id: categoryId,
  name: "Student Consultation",
  shortCode: "CNSLT",
  accentKey: "SIGNAL_OCHRE",
  description: "One-on-one academic consultations.",
  isDefault: false,
  isActive: true,
} as const;

test("Agenda category create and update normalize explicit editable fields", () => {
  const created = createAgendaCategorySchema.parse({
    name: "  Student Consultation  ",
    shortCode: "  cnslt  ",
    accentKey: "SIGNAL_OCHRE",
    description: "  One-on-one academic consultations.  ",
  });
  assert.deepEqual(created, {
    name: "Student Consultation",
    shortCode: "CNSLT",
    accentKey: "SIGNAL_OCHRE",
    description: "One-on-one academic consultations.",
  });
  assert.deepEqual(updateAgendaCategorySchema.parse({
    ...created,
    isActive: false,
  }), { ...created, isActive: false });
  assert.equal(createAgendaCategorySchema.parse({
    name: "Consultation",
    shortCode: "CNSLT",
    accentKey: "SIGNAL_OCHRE",
  }).description, null);
});

test("Agenda category validation rejects extra ownership fields and invalid values", () => {
  const valid = {
    name: "Consultation",
    shortCode: "CNSLT",
    accentKey: "SIGNAL_OCHRE",
    description: null,
  };
  for (const input of [
    { ...valid, userId: "client-controlled" },
    { ...valid, defaultKey: "EXAM" },
    { ...valid, isDefault: false },
    { ...valid, name: " " },
    { ...valid, name: "x".repeat(121) },
    { ...valid, shortCode: "HAS SPACE" },
    { ...valid, shortCode: "x".repeat(13) },
    { ...valid, accentKey: "blue-500" },
    { ...valid, description: "x".repeat(501) },
  ]) {
    assert.equal(createAgendaCategorySchema.safeParse(input).success, false);
  }
});

test("Agenda category identifiers and public responses remain strict", () => {
  assert.equal(agendaCategoryIdParamsSchema.safeParse({ categoryId }).success, true);
  assert.equal(agendaCategoryIdParamsSchema.safeParse({ categoryId: "category-one" }).success, false);
  assert.deepEqual(agendaCategoryRecordSchema.parse(publicCategory), publicCategory);
  assert.equal(agendaCategoryRecordSchema.safeParse({
    ...publicCategory,
    userId: "private",
  }).success, false);
  assert.equal(agendaCategoryListResponseSchema.safeParse({
    success: true,
    data: { categories: Array.from({ length: 101 }, () => publicCategory) },
  }).success, false);
  assert.deepEqual(agendaCategoryDeleteResponseSchema.parse({
    success: true,
    data: { categoryId, result: "DEACTIVATED" },
  }).data, { categoryId, result: "DEACTIVATED" });
});
