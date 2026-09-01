// Owns per-user Agenda category initialization, mutations, deletion rules, and public mapping.
import {
  AgendaCategoryAccentKey,
  AgendaCategoryDefaultKey,
  Prisma,
} from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type {
  CreateAgendaCategoryInput,
  UpdateAgendaCategoryInput,
} from "../validations/agenda-category.schema.js";
import {
  AGENDA_MAX_CATEGORIES,
  type AgendaCategoryRecord,
} from "../validations/agenda-category.response.js";
import {
  AGENDA_CATEGORY_DEFAULTS,
  isReservedAgendaCategoryShortCode,
} from "./agenda-category-defaults.js";

export type AgendaCategoryDatabaseRecord = {
  id: string;
  defaultKey: AgendaCategoryDefaultKey | null;
  name: string;
  shortCode: string;
  accentKey: AgendaCategoryAccentKey;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type AgendaCategoryWriteData = {
  name: string;
  shortCode: string;
  accentKey: AgendaCategoryAccentKey;
  description: string | null;
  isActive?: boolean;
};

const agendaCategorySelect = {
  id: true,
  defaultKey: true,
  name: true,
  shortCode: true,
  accentKey: true,
  description: true,
  isDefault: true,
  isActive: true,
} as const;

function isPrismaConflict(error: unknown, code: "P2002" | "P2003") {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function toDatabaseAccentKey(
  value: CreateAgendaCategoryInput["accentKey"],
): AgendaCategoryAccentKey {
  return AgendaCategoryAccentKey[value];
}

function toCategoryWriteData(
  input: CreateAgendaCategoryInput | UpdateAgendaCategoryInput,
): AgendaCategoryWriteData {
  return {
    name: input.name.trim(),
    shortCode: input.shortCode.trim().toUpperCase(),
    accentKey: toDatabaseAccentKey(input.accentKey),
    description: input.description?.trim() || null,
    ...("isActive" in input ? { isActive: input.isActive } : {}),
  };
}

export function toAgendaCategoryRecord(
  category: AgendaCategoryDatabaseRecord,
): AgendaCategoryRecord {
  return {
    id: category.id,
    name: category.name,
    shortCode: category.shortCode,
    accentKey: category.accentKey,
    description: category.description,
    isDefault: category.isDefault,
    isActive: category.isActive,
  };
}

export async function initializeDefaultAgendaCategories(
  userId: string,
  createMissingDefaults: (
    userId: string,
    templates: typeof AGENDA_CATEGORY_DEFAULTS,
  ) => Promise<void>,
) {
  await createMissingDefaults(userId, AGENDA_CATEGORY_DEFAULTS);
}

// Upserts only missing defaults in one transaction; composite uniqueness handles races.
export async function ensureDefaultAgendaCategories(userId: string) {
  await prisma.$transaction(async (transaction) => {
    await initializeDefaultAgendaCategories(userId, async (trustedUserId, templates) => {
      await transaction.agendaCategory.createMany({
        data: templates.map((template) => ({
          userId: trustedUserId,
          ...template,
          isDefault: true,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    });

    const defaultCount = await transaction.agendaCategory.count({
      where: {
        userId,
        defaultKey: {
          in: AGENDA_CATEGORY_DEFAULTS.map((template) => template.defaultKey),
        },
      },
    });
    if (defaultCount !== AGENDA_CATEGORY_DEFAULTS.length) {
      throw new Error("Unable to initialize canonical Agenda categories");
    }
  });
}

export async function findDefaultAgendaCategory(
  userId: string,
  defaultKey: AgendaCategoryDefaultKey,
) {
  return prisma.agendaCategory.findUnique({
    where: { userId_defaultKey: { userId, defaultKey } },
    select: agendaCategorySelect,
  });
}

export async function listAgendaCategories(userId: string) {
  await ensureDefaultAgendaCategories(userId);
  const categories = await prisma.agendaCategory.findMany({
    where: { userId },
    take: AGENDA_MAX_CATEGORIES,
    orderBy: [
      { isDefault: "desc" },
      { name: "asc" },
      { shortCode: "asc" },
      { id: "asc" },
    ],
    select: agendaCategorySelect,
  });
  return categories.map(toAgendaCategoryRecord);
}

export type CreateAgendaCategoryResult =
  | { status: "created"; category: AgendaCategoryRecord }
  | { status: "short_code_conflict" }
  | { status: "limit_reached" };

export async function createAgendaCategory(
  userId: string,
  input: CreateAgendaCategoryInput,
): Promise<CreateAgendaCategoryResult> {
  await ensureDefaultAgendaCategories(userId);
  const data = toCategoryWriteData(input);

  if (isReservedAgendaCategoryShortCode(data.shortCode)) {
    return { status: "short_code_conflict" };
  }

  const categoryCount = await prisma.agendaCategory.count({ where: { userId } });
  if (categoryCount >= AGENDA_MAX_CATEGORIES) {
    return { status: "limit_reached" };
  }

  try {
    const category = await prisma.agendaCategory.create({
      data: { userId, ...data, isDefault: false, defaultKey: null, isActive: true },
      select: agendaCategorySelect,
    });
    return { status: "created", category: toAgendaCategoryRecord(category) };
  } catch (error) {
    if (isPrismaConflict(error, "P2002")) {
      return { status: "short_code_conflict" };
    }
    throw error;
  }
}

export type UpdateAgendaCategoryResult =
  | { status: "updated"; category: AgendaCategoryRecord }
  | { status: "category_not_found" }
  | { status: "short_code_conflict" };

export async function updateAgendaCategory(
  userId: string,
  categoryId: string,
  input: UpdateAgendaCategoryInput,
): Promise<UpdateAgendaCategoryResult> {
  const ownedCategory = await prisma.agendaCategory.findFirst({
    where: { id: categoryId, userId },
    select: { defaultKey: true },
  });
  if (!ownedCategory) return { status: "category_not_found" };

  const data = toCategoryWriteData(input);
  if (isReservedAgendaCategoryShortCode(data.shortCode, ownedCategory.defaultKey)) {
    return { status: "short_code_conflict" };
  }

  try {
    const category = await prisma.agendaCategory.update({
      where: { id_userId: { id: categoryId, userId } },
      data,
      select: agendaCategorySelect,
    });
    return { status: "updated", category: toAgendaCategoryRecord(category) };
  } catch (error) {
    if (isPrismaConflict(error, "P2002")) {
      return { status: "short_code_conflict" };
    }
    throw error;
  }
}

export type DeleteAgendaCategoryResult =
  | { status: "deleted" | "deactivated" }
  | { status: "category_not_found" };

export async function deleteAgendaCategory(
  userId: string,
  categoryId: string,
): Promise<DeleteAgendaCategoryResult> {
  const category = await prisma.agendaCategory.findFirst({
    where: { id: categoryId, userId },
    select: { isDefault: true, _count: { select: { events: true } } },
  });
  if (!category) return { status: "category_not_found" };

  if (category.isDefault || category._count.events > 0) {
    await prisma.agendaCategory.update({
      where: { id_userId: { id: categoryId, userId } },
      data: { isActive: false },
      select: { id: true },
    });
    return { status: "deactivated" };
  }

  try {
    await prisma.agendaCategory.delete({
      where: { id_userId: { id: categoryId, userId } },
      select: { id: true },
    });
    return { status: "deleted" };
  } catch (error) {
    if (!isPrismaConflict(error, "P2003")) throw error;
    await prisma.agendaCategory.update({
      where: { id_userId: { id: categoryId, userId } },
      data: { isActive: false },
      select: { id: true },
    });
    return { status: "deactivated" };
  }
}

// Resets only canonical defaults; temporary reserved codes avoid unique swaps.
export async function restoreDefaultAgendaCategories(userId: string) {
  const categories = await prisma.$transaction(async (transaction) => {
    const existingDefaults = await transaction.agendaCategory.findMany({
      where: { userId, isDefault: true, defaultKey: { not: null } },
      select: { id: true, defaultKey: true },
    });

    for (const category of existingDefaults) {
      await transaction.agendaCategory.update({
        where: { id_userId: { id: category.id, userId } },
        data: { shortCode: `~${category.defaultKey}` },
        select: { id: true },
      });
    }

    for (const template of AGENDA_CATEGORY_DEFAULTS) {
      await transaction.agendaCategory.upsert({
        where: { userId_defaultKey: { userId, defaultKey: template.defaultKey } },
        update: { ...template, isDefault: true, isActive: true },
        create: { userId, ...template, isDefault: true, isActive: true },
        select: { id: true },
      });
    }

    return transaction.agendaCategory.findMany({
      where: { userId },
      take: AGENDA_MAX_CATEGORIES,
      orderBy: [
        { isDefault: "desc" },
        { name: "asc" },
        { shortCode: "asc" },
        { id: "asc" },
      ],
      select: agendaCategorySelect,
    });
  });

  return categories.map(toAgendaCategoryRecord);
}
