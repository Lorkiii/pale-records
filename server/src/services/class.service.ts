// Owns bounded class queries and explicit mapping between API and Prisma records.
import prisma from "../lib/db-client.js";
import type {
  CreateClassInput,
  UpdateClassInput,
} from "../validations/class.schema.js";
import type { ClassRecord } from "../validations/class.response.js";

type ClassDatabaseRecord = Omit<ClassRecord, "startDate" | "endDate"> & {
  startDate: Date | null;
  endDate: Date | null;
};

type CreateClassData = Omit<ClassDatabaseRecord, "id">;

export type ClassServiceDependencies = {
  findClasses: () => Promise<ClassDatabaseRecord[]>;
  insertClass: (data: CreateClassData) => Promise<ClassDatabaseRecord>;
  updateClassRecord: (
    classId: string,
    data: CreateClassData,
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
} as const;

const defaultDependencies: ClassServiceDependencies = {
  // Retrieves only the newest bounded set of active public class fields.
  findClasses: () =>
    prisma.class.findMany({
      where: { archivedAt: null },
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: classSelect,
    }),
  // Inserts only explicitly mapped class data and selects the public fields back.
  insertClass: (data) =>
    prisma.class.create({
      data,
      select: classSelect,
    }),
  // Atomically updates and reloads an active class so archived records cannot be edited.
  updateClassRecord: (classId, data) =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.class.updateMany({
        where: { id: classId, archivedAt: null },
        data,
      });

      if (result.count === 0) {
        return null;
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

// Maps internal database dates to the safe public class record representation.
function toClassRecord(record: ClassDatabaseRecord): ClassRecord {
  return {
    ...record,
    startDate: toDateOnly(record.startDate),
    endDate: toDateOnly(record.endDate),
  };
}

// Explicitly maps validated write input into nullable Prisma class fields.
function toClassData(input: CreateClassInput | UpdateClassInput): CreateClassData {
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

// Lists active classes through injectable dependencies for isolated testing.
export async function listClasses(
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  const classes = await dependencies.findClasses();
  return classes.map(toClassRecord);
}

// Creates a class from validated input and maps the stored record for the API.
export async function createClass(
  input: CreateClassInput,
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  const createdClass = await dependencies.insertClass(toClassData(input));

  return toClassRecord(createdClass);
}

// Replaces the editable fields of an active class or reports that no record matched.
export async function updateClass(
  classId: string,
  input: UpdateClassInput,
  dependencies: ClassServiceDependencies = defaultDependencies,
) {
  const updatedClass = await dependencies.updateClassRecord(
    classId,
    toClassData(input),
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
