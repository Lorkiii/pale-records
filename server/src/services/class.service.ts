// Owns bounded class queries, collision-safe schedule writes, and explicit public mapping.
import type { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type {
  ClassScheduleInput,
  CreateClassInput,
  UpdateClassInput,
} from "../validations/class.schema.js";
import type { ClassRecord } from "../validations/class.response.js";

type ClassScheduleDatabaseRecord = ClassRecord["schedules"][number];

type ClassDatabaseRecord = Omit<
  ClassRecord,
  "startDate" | "endDate" | "schedules"
> & {
  startDate: Date | null;
  endDate: Date | null;
  classSchedules: ClassScheduleDatabaseRecord[];
};

type ClassScalarData = Omit<ClassDatabaseRecord, "id" | "classSchedules">;
type CreateClassData = ClassScalarData & { schedules: ClassScheduleInput[] };
type UpdateClassData = ClassScalarData & { schedules?: ClassScheduleInput[] };

export class ClassScheduleConflictError extends Error {
  constructor() {
    super("A weekly schedule overlaps another active class.");
    this.name = "ClassScheduleConflictError";
  }
}

export type ClassServiceDependencies = {
  findClasses: () => Promise<ClassDatabaseRecord[]>;
  insertClass: (data: CreateClassData) => Promise<ClassDatabaseRecord>;
  updateClassRecord: (
    classId: string,
    data: UpdateClassData,
  ) => Promise<ClassDatabaseRecord | null>;
  markClassArchived: (
    classId: string,
    archivedAt: Date,
  ) => Promise<boolean>;
};

const classSelect = {
  id: true,
  subjectName: true,
  subjectCode: true,
  section: true,
  schoolYear: true,
  semester: true,
  teacher: true,
  room: true,
  startDate: true,
  endDate: true,
  classSchedules: {
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
    },
    orderBy: { dayOfWeek: "asc" },
  },
} as const;

// Serializes schedule writes before checking half-open time ranges on the same weekday.
async function ensureSchedulesAreAvailable(
  transaction: Prisma.TransactionClient,
  schedules: ClassScheduleInput[],
  excludedClassId?: string,
) {
  if (schedules.length === 0) {
    return;
  }

  // Every class schedule write uses this transaction lock, closing concurrent check/write races.
  await transaction.$queryRaw<Array<{ locked: number }>>`
    SELECT 1 AS "locked" FROM pg_advisory_xact_lock(1935764301)
  `;

  const conflict = await transaction.classSchedule.findFirst({
    where: {
      ...(excludedClassId ? { classId: { not: excludedClassId } } : {}),
      class: { archivedAt: null },
      OR: schedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: { lt: schedule.endTime },
        endTime: { gt: schedule.startTime },
      })),
    },
    select: { id: true },
  });

  if (conflict) {
    throw new ClassScheduleConflictError();
  }
}

const defaultDependencies: ClassServiceDependencies = {
  // Retrieves only the newest bounded set of active public class fields and schedules.
  findClasses: () =>
    prisma.class.findMany({
      where: { archivedAt: null },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: classSelect,
    }),
  // Creates scalar fields and optional schedule rows in one nested atomic write.
  insertClass: ({ schedules, ...classData }) =>
    prisma.$transaction(async (transaction) => {
      await ensureSchedulesAreAvailable(transaction, schedules);

      return transaction.class.create({
        data: {
          ...classData,
          classSchedules: schedules.length > 0
            ? { create: schedules }
            : undefined,
        },
        select: classSelect,
      });
    }),
  // Synchronizes one active class and its supplied schedule set in one transaction.
  updateClassRecord: (classId, { schedules, ...classData }) =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.class.updateMany({
        where: { id: classId, archivedAt: null },
        data: classData,
      });

      if (result.count === 0) {
        return null;
      }

      if (schedules !== undefined) {
        await ensureSchedulesAreAvailable(transaction, schedules, classId);

        const suppliedWeekdays = schedules.map((schedule) => schedule.dayOfWeek);

        await transaction.classSchedule.deleteMany({
          where: schedules.length === 0
            ? { classId }
            : {
              classId,
              dayOfWeek: { notIn: suppliedWeekdays },
            },
        });

        for (const schedule of schedules) {
          await transaction.classSchedule.upsert({
            where: {
              classId_dayOfWeek: {
                classId,
                dayOfWeek: schedule.dayOfWeek,
              },
            },
            update: {
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            },
            create: {
              classId,
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            },
          });
        }
      }

      return transaction.class.findUnique({
        where: { id: classId },
        select: classSelect,
      });
    }),
  // Records the server-generated archive time only when the class is still active.
  markClassArchived: async (classId, archivedAt) => {
    const result = await prisma.class.updateMany({
      where: { id: classId, archivedAt: null },
      data: { archivedAt },
    });

    return result.count === 1;
  },
};

// Converts a date-only API string into a stable UTC database timestamp.
function toDatabaseDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

// Converts a nullable database timestamp back to the API's date-only format.
function toDateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

// Maps schedule input explicitly and keeps database operations in weekday order.
function normalizeSchedules(schedules: ClassScheduleInput[]) {
  return schedules
    .map((schedule) => ({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    }))
    .sort((first, second) => first.dayOfWeek - second.dayOfWeek);
}

// Maps internal dates and schedule relation names to the safe public response shape.
function toClassRecord(record: ClassDatabaseRecord): ClassRecord {
  return {
    id: record.id,
    subjectName: record.subjectName,
    subjectCode: record.subjectCode,
    section: record.section,
    schoolYear: record.schoolYear,
    semester: record.semester,
    teacher: record.teacher,
    room: record.room,
    startDate: toDateOnly(record.startDate),
    endDate: toDateOnly(record.endDate),
    schedules: record.classSchedules
      .map((schedule) => ({
        id: schedule.id,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      }))
      .sort((first, second) => first.dayOfWeek - second.dayOfWeek),
  };
}

// Explicitly maps validated scalar input into nullable Prisma class fields.
function toClassScalarData(
  input: CreateClassInput | UpdateClassInput,
): ClassScalarData {
  return {
    subjectName: input.subjectName,
    subjectCode: input.subjectCode ?? null,
    section: input.section ?? null,
    schoolYear: input.schoolYear ?? null,
    semester: input.semester ?? null,
    teacher: input.teacher ?? null,
    room: input.room ?? null,
    startDate: toDatabaseDate(input.startDate),
    endDate: toDatabaseDate(input.endDate),
  };
}

// Combines create scalars with the normalized optional weekly schedule set.
function toCreateClassData(input: CreateClassInput): CreateClassData {
  return {
    ...toClassScalarData(input),
    schedules: normalizeSchedules(input.schedules),
  };
}

// Preserves existing schedules only when the update field was omitted.
function toUpdateClassData(input: UpdateClassInput): UpdateClassData {
  const classData: UpdateClassData = toClassScalarData(input);

  if (input.schedules !== undefined) {
    classData.schedules = normalizeSchedules(input.schedules);
  }

  return classData;
}

// Lists active classes through injectable dependencies for isolated testing.
export async function listClasses(
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  const classes = await dependencies.findClasses();
  return classes.map(toClassRecord);
}

// Creates a class and its schedules through one atomic dependency operation.
export async function createClass(
  input: CreateClassInput,
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  const createdClass = await dependencies.insertClass(toCreateClassData(input));

  return toClassRecord(createdClass);
}

// Replaces editable scalars and synchronizes schedules only when they were supplied.
export async function updateClass(
  classId: string,
  input: UpdateClassInput,
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  const updatedClass = await dependencies.updateClassRecord(
    classId,
    toUpdateClassData(input),
  );

  return updatedClass ? toClassRecord(updatedClass) : null;
}

// Supplies a trusted server timestamp to the non-destructive archive operation.
export function archiveClass(
  classId: string,
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  return dependencies.markClassArchived(classId, new Date());
}
