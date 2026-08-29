// Verifies Agenda ownership, Class checks, safe mapping, and idempotent legacy imports.
import assert from "node:assert/strict";
import test from "node:test";

import { AgendaEventType } from "../generated/prisma/client.js";
import {
  createAgendaEventSchema,
  importAgendaEventSchema,
} from "../validations/agenda.schema.js";
import {
  createAgendaEvent,
  deleteAgendaEvent,
  importAgendaEvent,
  listAgendaEvents,
  type AgendaEventDatabaseRecord,
  type AgendaServiceDependencies,
  toAgendaDateOnly,
  toAgendaEventRecord,
  toDatabaseAgendaDate,
  updateAgendaEvent,
} from "./agenda.service.js";

const userId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const otherUserId = "1d7f6a68-01d8-4abe-9f17-c3d03ed4ad86";
const eventId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const legacyEventId = "evt_1724900000000_ab12cd3";

const storedEvent: AgendaEventDatabaseRecord = {
  id: eventId,
  title: "Final examination",
  description: "Coverage: chapters 1-5",
  eventDate: new Date("2026-09-15T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "11:00",
  isAllDay: false,
  eventType: AgendaEventType.EXAM,
  classId,
  location: "Room 204",
  createdAt: new Date("2026-08-29T01:02:03.000Z"),
  updatedAt: new Date("2026-08-29T04:05:06.000Z"),
};

const validInput = createAgendaEventSchema.parse({
  title: "  Final examination  ",
  description: " Coverage: chapters 1-5 ",
  eventDate: "2026-09-15",
  startTime: "09:00",
  endTime: "11:00",
  isAllDay: false,
  eventType: "EXAM",
  classId,
  location: " Room 204 ",
});

const validImportInput = importAgendaEventSchema.parse({
  legacyEventId,
  ...validInput,
});

// Creates deterministic database fakes while allowing each test to replace one behavior.
function createDependencies(
  overrides: Partial<AgendaServiceDependencies> = {},
): AgendaServiceDependencies {
  return {
    findEvents: async () => [],
    classExists: async () => true,
    findOwnedEvent: async () => true,
    insertEvent: async () => storedEvent,
    updateOwnedEvent: async () => storedEvent,
    deleteOwnedEvent: async () => true,
    findImportedEvent: async () => null,
    insertImportedEvent: async () => storedEvent,
    isLegacyImportKeyConflict: () => false,
    ...overrides,
  };
}

test("Agenda converts date-only values through stable UTC database dates", () => {
  const databaseDate = toDatabaseAgendaDate("2026-09-15");

  assert.equal(databaseDate.toISOString(), "2026-09-15T00:00:00.000Z");
  assert.equal(toAgendaDateOnly(databaseDate), "2026-09-15");
});

test("Agenda explicitly maps only public fields and excludes userId", () => {
  const internalEvent = {
    ...storedEvent,
    userId,
    internalRelation: { id: "private" },
  };
  const result = toAgendaEventRecord(internalEvent);

  assert.deepEqual(result, {
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
  });
  assert.equal(Object.hasOwn(result, "userId"), false);
  assert.equal(Object.hasOwn(result, "internalRelation"), false);
  assert.equal(Object.hasOwn(result, "legacyImportKey"), false);
});

test("Agenda range listing passes the owner and inclusive UTC bounds and caps output", async () => {
  let receivedUserId = "";
  let receivedBounds: [Date, Date] | undefined;
  const databaseEvents = Array.from({ length: 501 }, (_, index) => ({
    ...storedEvent,
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  }));
  const result = await listAgendaEvents(
    userId,
    "2026-09-01",
    "2026-09-30",
    createDependencies({
      findEvents: async (trustedUserId, from, to) => {
        receivedUserId = trustedUserId;
        receivedBounds = [from, to];
        return databaseEvents;
      },
    }),
  );

  assert.equal(receivedUserId, userId);
  assert.deepEqual(receivedBounds?.map((date) => date.toISOString()), [
    "2026-09-01T00:00:00.000Z",
    "2026-09-30T00:00:00.000Z",
  ]);
  assert.equal(result.length, 500);
  assert.equal(result.every((event) => !Object.hasOwn(event, "userId")), true);
});

test("Agenda creation uses only the trusted user ID and explicit normalized data", async () => {
  let receivedUserId = "";
  let receivedData:
    | Parameters<AgendaServiceDependencies["insertEvent"]>[1]
    | undefined;
  const result = await createAgendaEvent(userId, validInput, createDependencies({
    insertEvent: async (trustedUserId, data) => {
      receivedUserId = trustedUserId;
      receivedData = data;
      return storedEvent;
    },
  }));

  assert.equal(receivedUserId, userId);
  assert.deepEqual(receivedData, {
    title: "Final examination",
    description: "Coverage: chapters 1-5",
    eventDate: new Date("2026-09-15T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "11:00",
    isAllDay: false,
    eventType: AgendaEventType.EXAM,
    classId,
    location: "Room 204",
  });
  assert.equal(result.status, "created");
  assert.equal(receivedData && Object.hasOwn(receivedData, "legacyImportKey"), false);
  if (result.status === "created") {
    assert.equal(Object.hasOwn(result.event, "userId"), false);
  }
});

test("Agenda creation returns a safe missing-Class result before persistence", async () => {
  let insertWasCalled = false;
  const result = await createAgendaEvent(userId, validInput, createDependencies({
    classExists: async () => false,
    insertEvent: async () => {
      insertWasCalled = true;
      return storedEvent;
    },
  }));

  assert.deepEqual(result, { status: "class_not_found" });
  assert.equal(insertWasCalled, false);
});

test("Agenda update succeeds only for the authenticated owner", async () => {
  let receivedScope: [string, string] | undefined;
  const result = await updateAgendaEvent(
    userId,
    eventId,
    validInput,
    createDependencies({
      updateOwnedEvent: async (trustedUserId, trustedEventId, data) => {
        receivedScope = [trustedUserId, trustedEventId];
        return {
          ...storedEvent,
          title: data.title,
          eventDate: data.eventDate,
        };
      },
    }),
  );

  assert.deepEqual(receivedScope, [userId, eventId]);
  assert.equal(result.status, "updated");
  if (result.status === "updated") {
    assert.equal(result.event.id, eventId);
    assert.equal(Object.hasOwn(result.event, "userId"), false);
  }
});

test("Agenda update treats another owner's event as missing before Class checks", async () => {
  let classWasChecked = false;
  let updateWasCalled = false;
  const result = await updateAgendaEvent(
    otherUserId,
    eventId,
    validInput,
    createDependencies({
      findOwnedEvent: async () => false,
      classExists: async () => {
        classWasChecked = true;
        return false;
      },
      updateOwnedEvent: async () => {
        updateWasCalled = true;
        return storedEvent;
      },
    }),
  );

  assert.deepEqual(result, { status: "event_not_found" });
  assert.equal(classWasChecked, false);
  assert.equal(updateWasCalled, false);
});

test("Agenda update returns the safe missing-Class result for an owned event", async () => {
  let updateWasCalled = false;
  const result = await updateAgendaEvent(
    userId,
    eventId,
    validInput,
    createDependencies({
      classExists: async () => false,
      updateOwnedEvent: async () => {
        updateWasCalled = true;
        return storedEvent;
      },
    }),
  );

  assert.deepEqual(result, { status: "class_not_found" });
  assert.equal(updateWasCalled, false);
});

test("Agenda deletion forwards both owner and event ID and hides other ownership", async () => {
  let receivedScope: [string, string] | undefined;
  const deleted = await deleteAgendaEvent(userId, eventId, createDependencies({
    deleteOwnedEvent: async (trustedUserId, trustedEventId) => {
      receivedScope = [trustedUserId, trustedEventId];
      return true;
    },
  }));
  const missing = await deleteAgendaEvent(otherUserId, eventId, createDependencies({
    deleteOwnedEvent: async () => false,
  }));

  assert.deepEqual(receivedScope, [userId, eventId]);
  assert.deepEqual(deleted, { status: "deleted" });
  assert.deepEqual(missing, { status: "event_not_found" });
});

test("Agenda legacy import creates one event with the trusted owner and generated key", async () => {
  let receivedUserId = "";
  let receivedLegacyImportKey = "";
  let receivedData:
    | Parameters<AgendaServiceDependencies["insertImportedEvent"]>[2]
    | undefined;

  const result = await importAgendaEvent(
    userId,
    validImportInput,
    createDependencies({
      insertImportedEvent: async (trustedUserId, legacyImportKey, data) => {
        receivedUserId = trustedUserId;
        receivedLegacyImportKey = legacyImportKey;
        receivedData = data;
        return storedEvent;
      },
    }),
  );

  assert.equal(receivedUserId, userId);
  assert.equal(receivedLegacyImportKey, `${userId}:${legacyEventId}`);
  assert.deepEqual(receivedData, {
    title: "Final examination",
    description: "Coverage: chapters 1-5",
    eventDate: new Date("2026-09-15T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "11:00",
    isAllDay: false,
    eventType: AgendaEventType.EXAM,
    classId,
    location: "Room 204",
  });
  assert.deepEqual(result, {
    event: toAgendaEventRecord(storedEvent),
    imported: true,
    classAssociationRemoved: false,
  });
});

test("Agenda legacy import returns the same user's existing imported event", async () => {
  let insertWasCalled = false;
  const result = await importAgendaEvent(
    userId,
    validImportInput,
    createDependencies({
      findImportedEvent: async (legacyImportKey) => {
        assert.equal(legacyImportKey, `${userId}:${legacyEventId}`);
        return storedEvent;
      },
      insertImportedEvent: async () => {
        insertWasCalled = true;
        return storedEvent;
      },
    }),
  );

  assert.equal(result.imported, false);
  assert.equal(insertWasCalled, false);
});

test("Different users can import the same legacy event ID under distinct keys", async () => {
  const receivedKeys: string[] = [];
  const dependencies = createDependencies({
    insertImportedEvent: async (trustedUserId, legacyImportKey) => {
      receivedKeys.push(legacyImportKey);
      return {
        ...storedEvent,
        id: trustedUserId === userId
          ? eventId
          : "c83d5f4f-8f2d-423d-9f58-b9de3bf44e11",
      };
    },
  });

  await importAgendaEvent(userId, validImportInput, dependencies);
  await importAgendaEvent(otherUserId, validImportInput, dependencies);

  assert.deepEqual(receivedKeys, [
    `${userId}:${legacyEventId}`,
    `${otherUserId}:${legacyEventId}`,
  ]);
});

test("Agenda legacy import clears only a missing Class association", async () => {
  let receivedClassId: string | null | undefined;
  const result = await importAgendaEvent(
    userId,
    validImportInput,
    createDependencies({
      classExists: async () => false,
      insertImportedEvent: async (trustedUserId, legacyImportKey, data) => {
        receivedClassId = data.classId;
        return { ...storedEvent, classId: null };
      },
    }),
  );

  assert.equal(receivedClassId, null);
  assert.equal(result.classAssociationRemoved, true);
  assert.equal(result.event.classId, null);
});

test("Agenda legacy import retains active and archived existing Classes", async () => {
  for (const classState of ["active", "archived"] as const) {
    let receivedClassId: string | null | undefined;
    const result = await importAgendaEvent(
      userId,
      validImportInput,
      createDependencies({
        classExists: async (receivedId) => {
          assert.equal(receivedId, classId);
          return classState === "active" || classState === "archived";
        },
        insertImportedEvent: async (trustedUserId, legacyImportKey, data) => {
          receivedClassId = data.classId;
          return storedEvent;
        },
      }),
    );

    assert.equal(receivedClassId, classId);
    assert.equal(result.classAssociationRemoved, false);
  }
});

test("Agenda legacy import reloads an existing event after its unique-key race", async () => {
  const conflict = new Error("private unique detail");
  let findCallCount = 0;
  const result = await importAgendaEvent(
    userId,
    validImportInput,
    createDependencies({
      findImportedEvent: async () => {
        findCallCount += 1;
        return findCallCount === 1 ? null : storedEvent;
      },
      insertImportedEvent: async () => {
        throw conflict;
      },
      isLegacyImportKeyConflict: (error) => error === conflict,
    }),
  );

  assert.equal(findCallCount, 2);
  assert.equal(result.imported, false);
  assert.equal(result.event.id, eventId);
});

test("Agenda normal update data cannot overwrite an internal legacy import key", async () => {
  let receivedData:
    | Parameters<AgendaServiceDependencies["updateOwnedEvent"]>[2]
    | undefined;
  const result = await updateAgendaEvent(
    userId,
    eventId,
    validInput,
    createDependencies({
      updateOwnedEvent: async (trustedUserId, trustedEventId, data) => {
        receivedData = data;
        return storedEvent;
      },
    }),
  );

  assert.equal(result.status, "updated");
  assert.equal(receivedData && Object.hasOwn(receivedData, "legacyImportKey"), false);
});
