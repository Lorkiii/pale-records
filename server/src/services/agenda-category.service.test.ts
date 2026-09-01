// Verifies canonical Agenda category defaults, idempotent initialization, and safe mapping.
import assert from "node:assert/strict";
import test from "node:test";

import {
  AgendaCategoryAccentKey,
  AgendaCategoryDefaultKey,
} from "../generated/prisma/client.js";
import { AGENDA_CATEGORY_DEFAULTS } from "./agenda-category-defaults.js";
import {
  initializeDefaultAgendaCategories,
  toAgendaCategoryRecord,
} from "./agenda-category.service.js";

const userId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";

test("Agenda owns exactly six unique canonical default templates", () => {
  assert.deepEqual(
    AGENDA_CATEGORY_DEFAULTS.map((template) => template.defaultKey),
    [
      AgendaCategoryDefaultKey.EXAM,
      AgendaCategoryDefaultKey.ASSIGNMENT,
      AgendaCategoryDefaultKey.ACTIVITY,
      AgendaCategoryDefaultKey.HOLIDAY,
      AgendaCategoryDefaultKey.MEETING,
      AgendaCategoryDefaultKey.NOTE,
    ],
  );
  assert.equal(new Set(AGENDA_CATEGORY_DEFAULTS.map((item) => item.shortCode)).size, 6);
  assert.equal(AGENDA_CATEGORY_DEFAULTS.every((item) => item.shortCode === item.shortCode.toUpperCase()), true);
});

test("default initialization remains idempotent across repeated and concurrent calls", async () => {
  const stored = new Set<string>();
  const createMissing = async (
    trustedUserId: string,
    templates: typeof AGENDA_CATEGORY_DEFAULTS,
  ) => {
    for (const template of templates) stored.add(`${trustedUserId}:${template.defaultKey}`);
  };

  await initializeDefaultAgendaCategories(userId, createMissing);
  await Promise.all([
    initializeDefaultAgendaCategories(userId, createMissing),
    initializeDefaultAgendaCategories(userId, createMissing),
  ]);

  assert.equal(stored.size, 6);
});

test("Agenda category mapping excludes ownership and internal default identity", () => {
  const category = toAgendaCategoryRecord({
    id: "805a2580-d0b5-48a8-8eb3-9356e464b838",
    defaultKey: AgendaCategoryDefaultKey.EXAM,
    name: "Renamed Examination",
    shortCode: "TEST",
    accentKey: AgendaCategoryAccentKey.SIGNAL_PURPLE,
    description: "Current display values.",
    isDefault: true,
    isActive: true,
  });
  assert.deepEqual(category, {
    id: "805a2580-d0b5-48a8-8eb3-9356e464b838",
    name: "Renamed Examination",
    shortCode: "TEST",
    accentKey: "SIGNAL_PURPLE",
    description: "Current display values.",
    isDefault: true,
    isActive: true,
  });
  assert.equal(Object.hasOwn(category, "userId"), false);
  assert.equal(Object.hasOwn(category, "defaultKey"), false);
});
