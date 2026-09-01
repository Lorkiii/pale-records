// Verifies Agenda responses expose only bounded safe event fields and strict envelopes.
import assert from "node:assert/strict";
import test from "node:test";

import {
  agendaEventCreateResponseSchema,
  agendaEventDeleteResponseSchema,
  agendaEventImportResponseSchema,
  agendaEventListResponseSchema,
  agendaEventRecordSchema,
  agendaEventUpdateResponseSchema,
} from "./agenda.response.js";

const eventId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const categoryId = "805a2580-d0b5-48a8-8eb3-9356e464b838";

const publicEvent = {
  id: eventId,
  title: "Final examination",
  description: "Coverage: chapters 1-5",
  eventDate: "2026-09-15",
  startTime: "09:00",
  endTime: "11:00",
  isAllDay: false,
  categoryId,
  category: {
    id: categoryId,
    name: "Examination",
    shortCode: "EXAM",
    accentKey: "SIGNAL_RED",
    isActive: true,
  },
  classId,
  location: "Room 204",
  completedAt: null,
  createdAt: "2026-08-29T01:02:03.000Z",
  updatedAt: "2026-08-29T04:05:06.000Z",
} as const;

test("Agenda event record accepts exactly the documented safe fields", () => {
  assert.deepEqual(agendaEventRecordSchema.parse(publicEvent), publicEvent);
  assert.equal(agendaEventRecordSchema.safeParse({
    ...publicEvent,
    eventDate: "2026-02-30",
  }).success, false);
  assert.equal(agendaEventRecordSchema.safeParse({
    ...publicEvent,
    isAllDay: true,
  }).success, false);
  assert.equal(agendaEventRecordSchema.safeParse({
    ...publicEvent,
    completedAt: "not-a-timestamp",
  }).success, false);
});

test("Agenda list, create, update, and delete envelopes remain strict", () => {
  assert.deepEqual(agendaEventListResponseSchema.parse({
    success: true,
    data: { events: [publicEvent] },
  }).data.events, [publicEvent]);
  assert.deepEqual(agendaEventCreateResponseSchema.parse({
    success: true,
    data: { event: publicEvent },
  }).data.event, publicEvent);
  assert.deepEqual(agendaEventUpdateResponseSchema.parse({
    success: true,
    data: { event: publicEvent },
  }).data.event, publicEvent);
  assert.deepEqual(agendaEventDeleteResponseSchema.parse({
    success: true,
    data: { eventId },
  }), {
    success: true,
    data: { eventId },
  });

  assert.equal(agendaEventDeleteResponseSchema.safeParse({
    success: true,
    data: { eventId, deleted: true },
  }).success, false);
});

test("Agenda response schemas reject userId and unknown record fields", () => {
  for (const unsafeEvent of [
    { ...publicEvent, userId: "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c" },
    { ...publicEvent, class: { id: classId } },
    { ...publicEvent, internalNote: "private" },
  ]) {
    assert.equal(agendaEventRecordSchema.safeParse(unsafeEvent).success, false);
    assert.equal(agendaEventCreateResponseSchema.safeParse({
      success: true,
      data: { event: unsafeEvent },
    }).success, false);
  }
});

test("Agenda list response rejects more than 500 events", () => {
  const events = Array.from({ length: 501 }, (_, index) => ({
    ...publicEvent,
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  }));

  assert.equal(agendaEventListResponseSchema.safeParse({
    success: true,
    data: { events: events.slice(0, 500) },
  }).success, true);
  assert.equal(agendaEventListResponseSchema.safeParse({
    success: true,
    data: { events },
  }).success, false);
});

test("Agenda import responses accept exact true and false acknowledgement states", () => {
  for (const data of [
    { event: publicEvent, imported: true, classAssociationRemoved: false },
    { event: publicEvent, imported: false, classAssociationRemoved: true },
  ]) {
    assert.deepEqual(agendaEventImportResponseSchema.parse({
      success: true,
      data,
    }).data, data);
  }
});

test("Agenda import responses reject internal and unknown fields", () => {
  for (const unsafeEvent of [
    { ...publicEvent, userId: "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c" },
    { ...publicEvent, legacyImportKey: "private-import-key" },
  ]) {
    assert.equal(agendaEventImportResponseSchema.safeParse({
      success: true,
      data: {
        event: unsafeEvent,
        imported: true,
        classAssociationRemoved: false,
      },
    }).success, false);
  }

  assert.equal(agendaEventImportResponseSchema.safeParse({
    success: true,
    data: {
      event: publicEvent,
      imported: true,
      classAssociationRemoved: false,
      legacyEventId: "private",
    },
  }).success, false);
});
