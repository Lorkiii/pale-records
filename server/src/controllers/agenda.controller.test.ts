// Verifies Agenda CRUD/import statuses, trusted-user flow, validation, and error forwarding.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import {
  createAgendaControllerHandlers,
  type AgendaControllerDependencies,
} from "./agenda.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import { validateQuery } from "../middleware/validate-query.js";
import {
  agendaEventIdParamsSchema,
  createAgendaEventSchema,
  importAgendaEventSchema,
  listAgendaEventsQuerySchema,
  updateAgendaEventSchema,
} from "../validations/agenda.schema.js";
import type { AgendaEventRecord } from "../validations/agenda.response.js";

const userId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const eventId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";

const authenticatedUser = {
  id: userId,
  firstName: "Ana",
  lastName: "Reyes",
  username: "ana.reyes",
  email: "ana@example.com",
};

const publicEvent: AgendaEventRecord = {
  id: eventId,
  title: "Final examination",
  description: "Coverage: chapters 1-5",
  eventDate: "2026-09-15",
  startTime: "09:00",
  endTime: "11:00",
  isAllDay: false,
  eventType: "EXAM",
  classId,
  location: "Room 204",
  createdAt: "2026-08-29T01:02:03.000Z",
  updatedAt: "2026-08-29T04:05:06.000Z",
};

// Builds one complete request body shared by create and replacement-style update tests.
function agendaEventBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Final examination",
    description: "Coverage: chapters 1-5",
    eventDate: "2026-09-15",
    startTime: "09:00",
    endTime: "11:00",
    isAllDay: false,
    eventType: "EXAM",
    classId,
    location: "Room 204",
    ...overrides,
  };
}

// Adds the browser identifier accepted only by the one-event import route.
function agendaImportBody(overrides: Record<string, unknown> = {}) {
  return {
    legacyEventId: "evt_1724900000000_ab12cd3",
    ...agendaEventBody(),
    ...overrides,
  };
}

// Mounts controller-focused routes with a fixed trusted user and injectable services.
function createTestApp(
  overrides: Partial<AgendaControllerDependencies> = {},
) {
  const dependencies: AgendaControllerDependencies = {
    listEvents: async () => [publicEvent],
    createEvent: async () => ({ status: "created", event: publicEvent }),
    importEvent: async () => ({
      event: publicEvent,
      imported: true,
      classAssociationRemoved: false,
    }),
    updateEvent: async () => ({ status: "updated", event: publicEvent }),
    deleteEvent: async () => ({ status: "deleted" }),
    ...overrides,
  };
  const handlers = createAgendaControllerHandlers(dependencies);
  const testApp = express();
  testApp.use(express.json());
  testApp.use((req, res, next) => {
    res.locals.authenticatedUser = authenticatedUser;
    next();
  });
  testApp.get(
    "/events",
    validateQuery(listAgendaEventsQuerySchema),
    handlers.listAgendaEventsController,
  );
  testApp.post(
    "/events",
    validateBody(createAgendaEventSchema),
    handlers.createAgendaEventController,
  );
  testApp.post(
    "/events/import",
    validateBody(importAgendaEventSchema),
    handlers.importAgendaEventController,
  );
  testApp.patch(
    "/events/:eventId",
    validateParams(agendaEventIdParamsSchema),
    validateBody(updateAgendaEventSchema),
    handlers.updateAgendaEventController,
  );
  testApp.delete(
    "/events/:eventId",
    validateParams(agendaEventIdParamsSchema),
    handlers.deleteAgendaEventController,
  );
  testApp.use(errorHandler);
  return testApp;
}

test("Agenda controllers return valid CRUD and import envelopes", async () => {
  const listResponse = await request(createTestApp())
    .get("/events?from=2026-09-01&to=2026-09-30");
  const createResponse = await request(createTestApp())
    .post("/events")
    .send(agendaEventBody());
  const importResponse = await request(createTestApp())
    .post("/events/import")
    .send(agendaImportBody());
  const updateResponse = await request(createTestApp())
    .patch(`/events/${eventId}`)
    .send(agendaEventBody({ title: "Updated examination" }));
  const deleteResponse = await request(createTestApp())
    .delete(`/events/${eventId}`);

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.data.events[0].id, eventId);
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.data.event.id, eventId);
  assert.equal(importResponse.status, 200);
  assert.deepEqual(importResponse.body, {
    success: true,
    data: {
      event: publicEvent,
      imported: true,
      classAssociationRemoved: false,
    },
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.data.event.id, eventId);
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.data.eventId, eventId);
});

test("Agenda controllers pass only the authenticated user ID to every service", async () => {
  const receivedUserIds: string[] = [];
  let receivedRange: [string, string] | undefined;
  let receivedCreateTitle = "";
  const testApp = createTestApp({
    listEvents: async (trustedUserId, from, to) => {
      receivedUserIds.push(trustedUserId);
      receivedRange = [from, to];
      return [publicEvent];
    },
    createEvent: async (trustedUserId, input) => {
      receivedUserIds.push(trustedUserId);
      receivedCreateTitle = input.title;
      return { status: "created", event: publicEvent };
    },
    importEvent: async (trustedUserId, input) => {
      receivedUserIds.push(trustedUserId);
      assert.equal(input.legacyEventId, "evt_1724900000000_ab12cd3");
      return {
        event: publicEvent,
        imported: true,
        classAssociationRemoved: false,
      };
    },
    updateEvent: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return { status: "updated", event: publicEvent };
    },
    deleteEvent: async (trustedUserId) => {
      receivedUserIds.push(trustedUserId);
      return { status: "deleted" };
    },
  });

  await request(testApp).get("/events?from=2026-09-01&to=2026-09-30");
  await request(testApp).post("/events").send(agendaEventBody({
    title: "  Final examination  ",
  }));
  await request(testApp).post("/events/import").send(agendaImportBody({
    legacyEventId: "  evt_1724900000000_ab12cd3  ",
  }));
  await request(testApp).patch(`/events/${eventId}`).send(agendaEventBody());
  await request(testApp).delete(`/events/${eventId}`);

  assert.deepEqual(receivedUserIds, [userId, userId, userId, userId, userId]);
  assert.deepEqual(receivedRange, ["2026-09-01", "2026-09-30"]);
  assert.equal(receivedCreateTitle, "Final examination");
});

test("Agenda controllers return safe event-not-found and Class-not-found errors", async () => {
  const missingUpdate = await request(createTestApp({
    updateEvent: async () => ({ status: "event_not_found" }),
  })).patch(`/events/${eventId}`).send(agendaEventBody());
  const missingDelete = await request(createTestApp({
    deleteEvent: async () => ({ status: "event_not_found" }),
  })).delete(`/events/${eventId}`);
  const missingCreateClass = await request(createTestApp({
    createEvent: async () => ({ status: "class_not_found" }),
  })).post("/events").send(agendaEventBody());
  const missingUpdateClass = await request(createTestApp({
    updateEvent: async () => ({ status: "class_not_found" }),
  })).patch(`/events/${eventId}`).send(agendaEventBody());

  for (const response of [missingUpdate, missingDelete]) {
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      success: false,
      error: {
        code: "AGENDA_EVENT_NOT_FOUND",
        message: "Agenda event was not found.",
      },
    });
  }
  for (const response of [missingCreateClass, missingUpdateClass]) {
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      success: false,
      error: {
        code: "AGENDA_CLASS_NOT_FOUND",
        message: "Associated class was not found.",
      },
    });
  }
});

test("Agenda validation middleware rejects malformed inputs before service access", async () => {
  let serviceWasCalled = false;
  const testApp = createTestApp({
    listEvents: async () => {
      serviceWasCalled = true;
      return [];
    },
    createEvent: async () => {
      serviceWasCalled = true;
      return { status: "created", event: publicEvent };
    },
    importEvent: async () => {
      serviceWasCalled = true;
      return {
        event: publicEvent,
        imported: true,
        classAssociationRemoved: false,
      };
    },
    updateEvent: async () => {
      serviceWasCalled = true;
      return { status: "updated", event: publicEvent };
    },
    deleteEvent: async () => {
      serviceWasCalled = true;
      return { status: "deleted" };
    },
  });
  const invalidResponses = await Promise.all([
    request(testApp).get("/events?from=2026-09-30&to=2026-09-01"),
    request(testApp).post("/events").send(agendaEventBody({ userId })),
    request(testApp).post("/events/import").send(agendaImportBody({
      legacyImportKey: "client-controlled",
    })),
    request(testApp).patch("/events/not-a-uuid").send(agendaEventBody()),
    request(testApp).delete("/events/not-a-uuid"),
  ]);

  for (const response of invalidResponses) {
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal(serviceWasCalled, false);
});

test("Unexpected Agenda errors reach the centralized safe error handler", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const listResponse = await request(createTestApp({
    listEvents: async () => {
      throw new Error("private database detail");
    },
  })).get("/events?from=2026-09-01&to=2026-09-30");
  const updateResponse = await request(createTestApp({
    updateEvent: async () => {
      throw new Error("private database detail");
    },
  })).patch(`/events/${eventId}`).send(agendaEventBody());
  const importResponse = await request(createTestApp({
    importEvent: async () => {
      throw new Error("private database detail");
    },
  })).post("/events/import").send(agendaImportBody());

  for (const response of [listResponse, updateResponse, importResponse]) {
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected server error occurred.",
      },
    });
  }
});
