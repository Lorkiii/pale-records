// Owns category-based Agenda events, completion, Class checks, legacy import, and public mapping.
import {
  AgendaCategoryAccentKey,
  AgendaCategoryDefaultKey,
  Prisma,
} from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type {
  CreateAgendaEventInput,
  ImportAgendaEventInput,
  LegacyAgendaEventTypeCode,
  UpdateAgendaEventInput,
} from "../validations/agenda.schema.js";
import {
  AGENDA_MAX_EVENTS,
  type AgendaEventRecord,
} from "../validations/agenda.response.js";
import {
  ensureDefaultAgendaCategories,
  findDefaultAgendaCategory,
} from "./agenda-category.service.js";

export type AgendaEventDatabaseRecord = {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  categoryId: string;
  category: {
    id: string;
    name: string;
    shortCode: string;
    accentKey: AgendaCategoryAccentKey;
    isActive: boolean;
  };
  classId: string | null;
  location: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AgendaEventWriteData = {
  title: string;
  description: string | null;
  eventDate: Date;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  categoryId: string;
  classId: string | null;
  location: string | null;
};

export type AgendaServiceDependencies = {
  findEvents: (
    userId: string,
    from: Date,
    to: Date,
  ) => Promise<AgendaEventDatabaseRecord[]>;
  classExists: (classId: string) => Promise<boolean>;
  findOwnedEvent: (
    userId: string,
    eventId: string,
  ) => Promise<{ categoryId: string } | null>;
  findOwnedCategory: (
    userId: string,
    categoryId: string,
  ) => Promise<{ isActive: boolean } | null>;
  insertEvent: (
    userId: string,
    data: AgendaEventWriteData,
  ) => Promise<AgendaEventDatabaseRecord>;
  updateOwnedEvent: (
    userId: string,
    eventId: string,
    data: AgendaEventWriteData,
  ) => Promise<AgendaEventDatabaseRecord | null>;
  deleteOwnedEvent: (userId: string, eventId: string) => Promise<boolean>;
  findImportedEvent: (
    legacyImportKey: string,
  ) => Promise<AgendaEventDatabaseRecord | null>;
  insertImportedEvent: (
    userId: string,
    legacyImportKey: string,
    data: AgendaEventWriteData,
  ) => Promise<AgendaEventDatabaseRecord>;
  isLegacyImportKeyConflict: (error: unknown) => boolean;
  ensureDefaultCategories: (userId: string) => Promise<void>;
  findDefaultCategory: (
    userId: string,
    defaultKey: AgendaCategoryDefaultKey,
  ) => Promise<{ id: string } | null>;
  completeOwnedEvent: (
    userId: string,
    eventId: string,
  ) => Promise<AgendaEventDatabaseRecord | null>;
  reopenOwnedEvent: (
    userId: string,
    eventId: string,
  ) => Promise<AgendaEventDatabaseRecord | null>;
};

const agendaEventSelect = {
  id: true,
  title: true,
  description: true,
  eventDate: true,
  startTime: true,
  endTime: true,
  isAllDay: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      name: true,
      shortCode: true,
      accentKey: true,
      isActive: true,
    },
  },
  classId: true,
  location: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Recognizes only the dedicated legacy-import uniqueness rule used for concurrent retries.
function isLegacyImportKeyConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  return (
    target === "AgendaEvent_legacyImportKey_key" ||
    target === "legacyImportKey" ||
    (Array.isArray(target) &&
      target.length === 1 &&
      target.includes("legacyImportKey"))
  );
}

const defaultDependencies: AgendaServiceDependencies = {
  // Uses the owner/date index and a deterministic bounded order for calendar reads.
  findEvents: (userId, from, to) =>
    prisma.agendaEvent.findMany({
      where: {
        userId,
        eventDate: { gte: from, lte: to },
      },
      take: AGENDA_MAX_EVENTS,
      orderBy: [
        { eventDate: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: agendaEventSelect,
    }),
  // Archived classes remain valid historical Agenda associations.
  classExists: async (classId) => {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    return classRecord !== null;
  },
  // Checks ownership before update-side category/Class validation to avoid disclosure.
  findOwnedEvent: async (userId, eventId) => {
    const event = await prisma.agendaEvent.findFirst({
      where: { id: eventId, userId },
      select: { categoryId: true },
    });
    return event;
  },
  findOwnedCategory: (userId, categoryId) =>
    prisma.agendaCategory.findFirst({
      where: { id: categoryId, userId },
      select: { isActive: true },
    }),
  // Combines the trusted session user with explicitly mapped editable fields.
  insertEvent: (userId, data) =>
    prisma.agendaEvent.create({
      data: { userId, ...data },
      select: agendaEventSelect,
    }),
  // Restricts the mutation and follow-up read to the same authenticated owner.
  updateOwnedEvent: (userId, eventId, data) =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.agendaEvent.updateMany({
        where: { id: eventId, userId },
        data,
      });

      if (result.count === 0) {
        return null;
      }

      return transaction.agendaEvent.findFirst({
        where: { id: eventId, userId },
        select: agendaEventSelect,
      });
    }),
  // A scoped delete makes another user's identifier indistinguishable from a missing one.
  deleteOwnedEvent: async (userId, eventId) => {
    const result = await prisma.agendaEvent.deleteMany({
      where: { id: eventId, userId },
    });
    return result.count === 1;
  },
  // Looks up one exact server-generated idempotency key without exposing it publicly.
  findImportedEvent: (legacyImportKey) =>
    prisma.agendaEvent.findUnique({
      where: { legacyImportKey },
      select: agendaEventSelect,
    }),
  // Persists the trusted owner and internal import key alongside explicit event fields.
  insertImportedEvent: (userId, legacyImportKey, data) =>
    prisma.agendaEvent.create({
      data: { userId, legacyImportKey, ...data },
      select: agendaEventSelect,
    }),
  isLegacyImportKeyConflict,
  ensureDefaultCategories: ensureDefaultAgendaCategories,
  findDefaultCategory: async (userId, defaultKey) => {
    const category = await findDefaultAgendaCategory(userId, defaultKey);
    return category ? { id: category.id } : null;
  },
  completeOwnedEvent: (userId, eventId) =>
    prisma.$transaction(async (transaction) => {
      await transaction.agendaEvent.updateMany({
        where: { id: eventId, userId, completedAt: null },
        data: { completedAt: new Date() },
      });
      return transaction.agendaEvent.findFirst({
        where: { id: eventId, userId },
        select: agendaEventSelect,
      });
    }),
  reopenOwnedEvent: (userId, eventId) =>
    prisma.$transaction(async (transaction) => {
      await transaction.agendaEvent.updateMany({
        where: { id: eventId, userId, completedAt: { not: null } },
        data: { completedAt: null },
      });
      return transaction.agendaEvent.findFirst({
        where: { id: eventId, userId },
        select: agendaEventSelect,
      });
    }),
};

// Converts a validated calendar date to Prisma's stable UTC date-only transport value.
export function toDatabaseAgendaDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

// Converts a PostgreSQL DATE value to the public YYYY-MM-DD representation.
export function toAgendaDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

// Maps historical browser type codes to the matching canonical default identity.
function toDefaultCategoryKey(
  value: LegacyAgendaEventTypeCode,
): AgendaCategoryDefaultKey {
  switch (value) {
    case "EXAM":
      return AgendaCategoryDefaultKey.EXAM;
    case "ASSIGNMENT":
      return AgendaCategoryDefaultKey.ASSIGNMENT;
    case "ACTIVITY":
      return AgendaCategoryDefaultKey.ACTIVITY;
    case "HOLIDAY":
      return AgendaCategoryDefaultKey.HOLIDAY;
    case "MEETING":
      return AgendaCategoryDefaultKey.MEETING;
    case "NOTE":
      return AgendaCategoryDefaultKey.NOTE;
  }
}

// Normalizes optional strings defensively even when the service is tested without HTTP middleware.
function toNullableTrimmedString(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

// Explicitly maps the complete editable contract into database-ready values.
function toAgendaEventWriteData(
  input: CreateAgendaEventInput | UpdateAgendaEventInput | ImportAgendaEventInput,
  categoryId: string,
): AgendaEventWriteData {
  return {
    title: input.title.trim(),
    description: toNullableTrimmedString(input.description),
    eventDate: toDatabaseAgendaDate(input.eventDate),
    startTime: toNullableTrimmedString(input.startTime),
    endTime: toNullableTrimmedString(input.endTime),
    isAllDay: input.isAllDay,
    categoryId,
    classId: input.classId ?? null,
    location: toNullableTrimmedString(input.location),
  };
}

// Maps only the documented public fields and excludes ownership/internal relation data.
export function toAgendaEventRecord(
  event: AgendaEventDatabaseRecord,
): AgendaEventRecord {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventDate: toAgendaDateOnly(event.eventDate),
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: event.isAllDay,
    categoryId: event.categoryId,
    category: {
      id: event.category.id,
      name: event.category.name,
      shortCode: event.category.shortCode,
      accentKey: event.category.accentKey,
      isActive: event.category.isActive,
    },
    classId: event.classId,
    location: event.location,
    completedAt: event.completedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

// Lists only the authenticated user's bounded inclusive date range.
export async function listAgendaEvents(
  userId: string,
  from: string,
  to: string,
  dependencies: AgendaServiceDependencies = defaultDependencies,
) {
  const events = await dependencies.findEvents(
    userId,
    toDatabaseAgendaDate(from),
    toDatabaseAgendaDate(to),
  );

  return events.slice(0, AGENDA_MAX_EVENTS).map(toAgendaEventRecord);
}

export type CreateAgendaEventResult =
  | { status: "created"; event: AgendaEventRecord }
  | { status: "class_not_found" }
  | { status: "category_not_found" };

// Creates an event for the trusted authenticated user after any Class check.
export async function createAgendaEvent(
  userId: string,
  input: CreateAgendaEventInput,
  dependencies: AgendaServiceDependencies = defaultDependencies,
): Promise<CreateAgendaEventResult> {
  const category = await dependencies.findOwnedCategory(userId, input.categoryId);
  if (!category?.isActive) {
    return { status: "category_not_found" };
  }

  const data = toAgendaEventWriteData(input, input.categoryId);

  if (data.classId !== null && !(await dependencies.classExists(data.classId))) {
    return { status: "class_not_found" };
  }

  const event = await dependencies.insertEvent(userId, data);
  return { status: "created", event: toAgendaEventRecord(event) };
}

export type ImportAgendaEventResult = {
  event: AgendaEventRecord;
  imported: boolean;
  classAssociationRemoved: boolean;
};

// Imports one legacy event under a trusted per-user idempotency key and tolerates safe retries.
export async function importAgendaEvent(
  userId: string,
  input: ImportAgendaEventInput,
  dependencies: AgendaServiceDependencies = defaultDependencies,
): Promise<ImportAgendaEventResult> {
  const legacyImportKey = `${userId}:${input.legacyEventId.trim()}`;
  const existingEvent = await dependencies.findImportedEvent(legacyImportKey);

  if (existingEvent) {
    return {
      event: toAgendaEventRecord(existingEvent),
      imported: false,
      classAssociationRemoved:
        input.classId !== null && existingEvent.classId === null,
    };
  }

  await dependencies.ensureDefaultCategories(userId);
  const defaultCategory = await dependencies.findDefaultCategory(
    userId,
    toDefaultCategoryKey(input.eventType),
  );
  if (!defaultCategory) {
    throw new Error("Default Agenda category initialization failed");
  }

  const data = toAgendaEventWriteData(input, defaultCategory.id);
  let classAssociationRemoved = false;

  if (data.classId !== null && !(await dependencies.classExists(data.classId))) {
    data.classId = null;
    classAssociationRemoved = true;
  }

  try {
    const event = await dependencies.insertImportedEvent(
      userId,
      legacyImportKey,
      data,
    );
    return {
      event: toAgendaEventRecord(event),
      imported: true,
      classAssociationRemoved,
    };
  } catch (error) {
    if (!dependencies.isLegacyImportKeyConflict(error)) {
      throw error;
    }

    const racedEvent = await dependencies.findImportedEvent(legacyImportKey);
    if (!racedEvent) {
      throw error;
    }

    return {
      event: toAgendaEventRecord(racedEvent),
      imported: false,
      classAssociationRemoved:
        input.classId !== null && racedEvent.classId === null,
    };
  }
}

export type UpdateAgendaEventResult =
  | { status: "updated"; event: AgendaEventRecord }
  | { status: "event_not_found" }
  | { status: "class_not_found" }
  | { status: "category_not_found" };

// Replaces one owner's complete editable event payload without revealing other users' events.
export async function updateAgendaEvent(
  userId: string,
  eventId: string,
  input: UpdateAgendaEventInput,
  dependencies: AgendaServiceDependencies = defaultDependencies,
): Promise<UpdateAgendaEventResult> {
  const ownedEvent = await dependencies.findOwnedEvent(userId, eventId);
  if (!ownedEvent) {
    return { status: "event_not_found" };
  }

  if (input.categoryId !== ownedEvent.categoryId) {
    const category = await dependencies.findOwnedCategory(userId, input.categoryId);
    if (!category?.isActive) {
      return { status: "category_not_found" };
    }
  }

  const data = toAgendaEventWriteData(input, input.categoryId);
  if (data.classId !== null && !(await dependencies.classExists(data.classId))) {
    return { status: "class_not_found" };
  }

  const event = await dependencies.updateOwnedEvent(userId, eventId, data);
  return event
    ? { status: "updated", event: toAgendaEventRecord(event) }
    : { status: "event_not_found" };
}

// Deletes only an event owned by the authenticated user.
export async function deleteAgendaEvent(
  userId: string,
  eventId: string,
  dependencies: AgendaServiceDependencies = defaultDependencies,
) {
  const wasDeleted = await dependencies.deleteOwnedEvent(userId, eventId);
  return wasDeleted
    ? { status: "deleted" as const }
    : { status: "event_not_found" as const };
}

// Completes one owned event idempotently while retaining its first completion time.
export async function completeAgendaEvent(
  userId: string,
  eventId: string,
  dependencies: AgendaServiceDependencies = defaultDependencies,
) {
  const event = await dependencies.completeOwnedEvent(userId, eventId);
  return event
    ? { status: "updated" as const, event: toAgendaEventRecord(event) }
    : { status: "event_not_found" as const };
}

// Reopens one owned event idempotently without changing any other event field.
export async function reopenAgendaEvent(
  userId: string,
  eventId: string,
  dependencies: AgendaServiceDependencies = defaultDependencies,
) {
  const event = await dependencies.reopenOwnedEvent(userId, eventId);
  return event
    ? { status: "updated" as const, event: toAgendaEventRecord(event) }
    : { status: "event_not_found" as const };
}
