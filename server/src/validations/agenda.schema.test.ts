// Verifies strict Agenda dates, ranges, write/import payloads, identifiers, and normalization.
import assert from "node:assert/strict";
import test from "node:test";

import {
  agendaEventIdParamsSchema,
  createAgendaEventSchema,
  importAgendaEventSchema,
  listAgendaEventsQuerySchema,
  updateAgendaEventSchema,
} from "./agenda.schema.js";

const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const eventId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const categoryId = "805a2580-d0b5-48a8-8eb3-9356e464b838";

// Builds one valid complete payload while allowing focused fields to vary.
function agendaEventInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Final examination",
    description: "Coverage: chapters 1-5",
    eventDate: "2026-09-15",
    startTime: "09:00",
    endTime: "11:00",
    isAllDay: false,
    categoryId,
    classId,
    location: "Room 204",
    ...overrides,
  };
}

// Adds the legacy browser identifier required only by the import endpoint.
function agendaImportInput(overrides: Record<string, unknown> = {}) {
  const { categoryId: unusedCategoryId, ...eventFields } = agendaEventInput();
  void unusedCategoryId;
  return {
    legacyEventId: "evt_1724900000000_ab12cd3",
    ...eventFields,
    eventType: "EXAM",
    ...overrides,
  };
}

test("Agenda accepts and normalizes a valid complete event payload", () => {
  const result = createAgendaEventSchema.parse(agendaEventInput({
    title: "  Final examination  ",
    description: "  Coverage: chapters 1-5  ",
    location: "   ",
    startTime: "",
    endTime: undefined,
  }));

  assert.deepEqual(result, {
    title: "Final examination",
    description: "Coverage: chapters 1-5",
    eventDate: "2026-09-15",
    startTime: null,
    endTime: null,
    isAllDay: false,
    categoryId,
    classId,
    location: null,
  });
  assert.deepEqual(updateAgendaEventSchema.parse(result), result);
});

test("Agenda legacy import accepts all six historical event types", () => {
  for (const eventType of [
    "EXAM",
    "ASSIGNMENT",
    "ACTIVITY",
    "HOLIDAY",
    "MEETING",
    "NOTE",
  ]) {
    assert.equal(importAgendaEventSchema.safeParse(
      agendaImportInput({ eventType }),
    ).success, true);
  }
});

test("Agenda rejects malformed and impossible event or query dates", () => {
  for (const eventDate of ["09/15/2026", "2026-9-15", "2026-02-30"]) {
    assert.equal(createAgendaEventSchema.safeParse(
      agendaEventInput({ eventDate }),
    ).success, false);
  }

  for (const query of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-09-01", to: "09/30/2026" },
    { from: "2026-09-01" },
  ]) {
    assert.equal(listAgendaEventsQuerySchema.safeParse(query).success, false);
  }
});

test("Agenda rejects unknown request fields", () => {
  assert.equal(createAgendaEventSchema.safeParse({
    ...agendaEventInput(),
    userId: "client-controlled",
  }).success, false);
  assert.equal(updateAgendaEventSchema.safeParse({
    ...agendaEventInput(),
    id: eventId,
  }).success, false);
  assert.equal(listAgendaEventsQuerySchema.safeParse({
    from: "2026-09-01",
    to: "2026-09-30",
    userId: "client-controlled",
  }).success, false);
});

test("Agenda rejects empty and oversized titles", () => {
  for (const title of ["   ", "x".repeat(161)]) {
    assert.equal(createAgendaEventSchema.safeParse(
      agendaEventInput({ title }),
    ).success, false);
  }
  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ title: "x".repeat(160) }),
  ).success, true);
});

test("Agenda rejects oversized optional text", () => {
  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ description: "x".repeat(2001) }),
  ).success, false);
  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ location: "x".repeat(161) }),
  ).success, false);
});

test("Agenda parameter, category, and Class fields accept only UUID identifiers", () => {
  assert.equal(agendaEventIdParamsSchema.safeParse({ eventId }).success, true);
  assert.equal(agendaEventIdParamsSchema.safeParse({ eventId: "event-one" }).success, false);
  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ classId: "class-one" }),
  ).success, false);
  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ categoryId: "category-one" }),
  ).success, false);
  assert.equal(createAgendaEventSchema.parse(
    agendaEventInput({ classId: "" }),
  ).classId, null);
});

test("Agenda rejects invalid 24-hour time formats", () => {
  for (const startTime of ["9:00", "09:0", "24:00", "09:60", "noon"]) {
    assert.equal(createAgendaEventSchema.safeParse(
      agendaEventInput({ startTime }),
    ).success, false);
  }
});

test("Agenda rejects all-day events containing either time", () => {
  for (const times of [
    { startTime: "09:00", endTime: null },
    { startTime: null, endTime: "11:00" },
    { startTime: "09:00", endTime: "11:00" },
  ]) {
    assert.equal(createAgendaEventSchema.safeParse(
      agendaEventInput({ isAllDay: true, ...times }),
    ).success, false);
  }

  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ isAllDay: true, startTime: null, endTime: null }),
  ).success, true);
});

test("Agenda rejects equal and reversed time ranges while allowing either optional time", () => {
  for (const endTime of ["09:00", "08:59"]) {
    assert.equal(createAgendaEventSchema.safeParse(
      agendaEventInput({ startTime: "09:00", endTime }),
    ).success, false);
  }

  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ startTime: "09:00", endTime: null }),
  ).success, true);
  assert.equal(createAgendaEventSchema.safeParse(
    agendaEventInput({ startTime: null, endTime: "11:00" }),
  ).success, true);
});

test("Agenda rejects reversed and more-than-62-day inclusive query ranges", () => {
  assert.equal(listAgendaEventsQuerySchema.safeParse({
    from: "2026-09-02",
    to: "2026-09-01",
  }).success, false);
  assert.equal(listAgendaEventsQuerySchema.safeParse({
    from: "2026-01-01",
    to: "2026-03-03",
  }).success, true);
  assert.equal(listAgendaEventsQuerySchema.safeParse({
    from: "2026-01-01",
    to: "2026-03-04",
  }).success, false);
});

test("Agenda accepts and normalizes one valid legacy import payload", () => {
  const result = importAgendaEventSchema.parse(agendaImportInput({
    legacyEventId: "  old-browser-event  ",
    description: " ",
    classId: null,
  }));

  assert.equal(result.legacyEventId, "old-browser-event");
  assert.equal(result.description, null);
  assert.equal(result.classId, null);
});

test("Agenda import rejects empty and oversized legacy identifiers", () => {
  for (const legacyEventId of ["   ", "x".repeat(161)]) {
    assert.equal(importAgendaEventSchema.safeParse(
      agendaImportInput({ legacyEventId }),
    ).success, false);
  }
});

test("Agenda import rejects client-controlled and unknown internal fields", () => {
  for (const unsafeField of [
    { userId: "client-controlled" },
    { legacyImportKey: `${classId}:legacy` },
    { createdAt: "2026-08-29T01:02:03.000Z" },
    { updatedAt: "2026-08-29T04:05:06.000Z" },
    { extra: true },
  ]) {
    assert.equal(importAgendaEventSchema.safeParse({
      ...agendaImportInput(),
      ...unsafeField,
    }).success, false);
  }
});

test("Agenda import retains the existing event validation rules", () => {
  for (const overrides of [
    { title: " " },
    { eventDate: "2026-02-30" },
    { startTime: "24:00" },
    { isAllDay: true, startTime: "09:00", endTime: null },
    { startTime: "11:00", endTime: "09:00" },
    { eventType: "REMINDER" },
    { classId: "not-a-uuid" },
  ]) {
    assert.equal(importAgendaEventSchema.safeParse(
      agendaImportInput(overrides),
    ).success, false);
  }
});
