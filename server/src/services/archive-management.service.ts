// Lists archived classes and students and deletes eligible selections after password confirmation.
import { compare } from "bcryptjs";
import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";

const PAGE_SIZE = 50;

export type ArchiveDeletionResult =
  | { status: "deleted"; deletedIds: string[] }
  | { status: "invalid_password" }
  | { status: "selection_changed" }
  | { status: "protected"; blockedIds: string[] };

class ArchiveSelectionChangedError extends Error {}

type ClassHistoryCounts = {
  attendanceSessions: number;
  attendanceMonthGenerations: number;
  recitationSessions: number;
  agendaEvents: number;
};

type StudentHistoryCounts = {
  attendanceRecords: number;
  recitationRecords: number;
};

type ClassDeletionStore = {
  find: () => Promise<Array<{ id: string; _count: ClassHistoryCounts }>>;
  delete: () => Promise<number>;
};

type StudentDeletionStore = {
  find: () => Promise<Array<{ id: string; _count: StudentHistoryCounts }>>;
  delete: () => Promise<number>;
};

// Keeps the list indicator and deletion guard aligned with every saved class association.
export function canDeleteArchivedClass(counts: ClassHistoryCounts) {
  return counts.attendanceSessions === 0 &&
    counts.attendanceMonthGenerations === 0 &&
    counts.recitationSessions === 0 &&
    counts.agendaEvents === 0;
}

// Prevents student removal when either historical record collection is present.
export function canDeleteArchivedStudent(counts: StudentHistoryCounts) {
  return counts.attendanceRecords === 0 && counts.recitationRecords === 0;
}

// Uses only the authenticated account's stored hash; the supplied password is never persisted.
async function hasCurrentPassword(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return user !== null && compare(currentPassword, user.passwordHash);
}

// Exposes one bounded page and a server-derived deletion eligibility indicator.
export async function listArchivedClasses(page: number) {
  const records = await prisma.class.findMany({
    where: { archivedAt: { not: null } },
    orderBy: [{ archivedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      subjectName: true,
      subjectCode: true,
      section: true,
      schoolYear: true,
      semester: true,
      archivedAt: true,
      _count: {
        select: {
          attendanceSessions: true,
          attendanceMonthGenerations: true,
          recitationSessions: true,
          agendaEvents: true,
        },
      },
    },
  });

  return {
    classes: records.slice(0, PAGE_SIZE).map(({ _count, archivedAt, ...record }) => ({
      ...record,
      archivedAt: archivedAt!.toISOString(),
      canDelete: canDeleteArchivedClass(_count),
    })),
    hasMore: records.length > PAGE_SIZE,
  };
}

// Includes every saved enrollment so archived student details remain complete.
export async function listArchivedStudents(page: number) {
  const records = await prisma.student.findMany({
    where: { archivedAt: { not: null } },
    orderBy: [{ archivedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      studentNo: true,
      firstName: true,
      lastName: true,
      archivedAt: true,
      enrollments: {
        select: {
          class: {
            select: {
              id: true,
              subjectName: true,
              subjectCode: true,
              section: true,
            },
          },
        },
      },
      _count: {
        select: { attendanceRecords: true, recitationRecords: true },
      },
    },
  });

  return {
    students: records.slice(0, PAGE_SIZE).map(({ _count, enrollments, archivedAt, ...record }) => ({
      ...record,
      archivedAt: archivedAt!.toISOString(),
      canDelete: canDeleteArchivedStudent(_count),
      classes: enrollments.map(({ class: classRecord }) => classRecord).sort(
        (left, right) => left.subjectName.localeCompare(right.subjectName) || left.id.localeCompare(right.id),
      ),
    })),
    hasMore: records.length > PAGE_SIZE,
  };
}

// Treats concurrent selection changes as a conflict without exposing database details.
function isSelectionConflict(error: unknown) {
  return error instanceof ArchiveSelectionChangedError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2003", "P2034"].includes(error.code));
}

// Checks the complete class selection before allowing one transactional delete statement.
export async function deleteEligibleArchivedClasses(
  ids: string[],
  store: ClassDeletionStore,
): Promise<ArchiveDeletionResult> {
  const records = await store.find();
  if (records.length !== ids.length) {
    return { status: "selection_changed" };
  }
  const blockedIds = records.filter(({ _count }) =>
    !canDeleteArchivedClass(_count)).map(({ id }) => id);
  if (blockedIds.length > 0) {
    return { status: "protected", blockedIds };
  }
  if (await store.delete() !== ids.length) {
    throw new ArchiveSelectionChangedError();
  }
  return { status: "deleted", deletedIds: ids };
}

// Checks the complete student selection before allowing one transactional delete statement.
export async function deleteEligibleArchivedStudents(
  ids: string[],
  store: StudentDeletionStore,
): Promise<ArchiveDeletionResult> {
  const records = await store.find();
  if (records.length !== ids.length) {
    return { status: "selection_changed" };
  }
  const blockedIds = records.filter(({ _count }) =>
    !canDeleteArchivedStudent(_count)).map(({ id }) => id);
  if (blockedIds.length > 0) {
    return { status: "protected", blockedIds };
  }
  if (await store.delete() !== ids.length) {
    throw new ArchiveSelectionChangedError();
  }
  return { status: "deleted", deletedIds: ids };
}

// Prevents cascades into saved class history and commits the whole batch together.
export async function deleteArchivedClasses(
  userId: string,
  ids: string[],
  currentPassword: string,
): Promise<ArchiveDeletionResult> {
  if (!await hasCurrentPassword(userId, currentPassword)) {
    return { status: "invalid_password" };
  }

  try {
    return await prisma.$transaction(async (transaction): Promise<ArchiveDeletionResult> =>
      deleteEligibleArchivedClasses(ids, {
        find: () => transaction.class.findMany({
        where: { id: { in: ids }, archivedAt: { not: null } },
        select: {
          id: true,
          _count: {
            select: {
              attendanceSessions: true,
              attendanceMonthGenerations: true,
              recitationSessions: true,
              agendaEvents: true,
            },
          },
        },
        }),
        delete: async () => (await transaction.class.deleteMany({
          where: { id: { in: ids }, archivedAt: { not: null } },
        })).count,
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isSelectionConflict(error)) return { status: "selection_changed" };
    throw error;
  }
}

// Prevents cascades into saved student history and commits the whole batch together.
export async function deleteArchivedStudents(
  userId: string,
  ids: string[],
  currentPassword: string,
): Promise<ArchiveDeletionResult> {
  if (!await hasCurrentPassword(userId, currentPassword)) {
    return { status: "invalid_password" };
  }

  try {
    return await prisma.$transaction(async (transaction): Promise<ArchiveDeletionResult> =>
      deleteEligibleArchivedStudents(ids, {
        find: () => transaction.student.findMany({
        where: { id: { in: ids }, archivedAt: { not: null } },
        select: {
          id: true,
          _count: { select: { attendanceRecords: true, recitationRecords: true } },
        },
        }),
        delete: async () => (await transaction.student.deleteMany({
          where: { id: { in: ids }, archivedAt: { not: null } },
        })).count,
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isSelectionConflict(error)) return { status: "selection_changed" };
    throw error;
  }
}
