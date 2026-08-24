// Owns bounded student queries and atomic creation of student-class enrollments.
import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type { CreateStudentInput } from "../validations/student.schema.js";
import type {
  StudentClassRecord,
  StudentRecord,
} from "../validations/student.response.js";

type StudentDatabaseRecord = {
  id: string;
  studentNo: string | null;
  firstName: string;
  lastName: string;
  enrollments: Array<{ class: StudentClassRecord }>;
};

type CreateStudentData = {
  studentNo: string | null;
  firstName: string;
  lastName: string;
  classIds: string[];
};

export type StudentServiceDependencies = {
  findStudents: () => Promise<StudentDatabaseRecord[]>;
  findActiveClassIds: (classIds: string[]) => Promise<string[]>;
  insertStudent: (data: CreateStudentData) => Promise<StudentDatabaseRecord>;
};

export class StudentNumberConflictError extends Error {
  constructor() {
    super("The normalized student number already exists.");
    this.name = "StudentNumberConflictError";
  }
}

const studentClassSelect = {
  id: true,
  subjectName: true,
  subjectCode: true,
  section: true,
} as const;

const studentSelect = {
  id: true,
  studentNo: true,
  firstName: true,
  lastName: true,
  enrollments: {
    select: {
      class: {
        select: studentClassSelect,
      },
    },
  },
} as const;

// Recognizes only the student-number unique constraint without hiding other failures.
function isStudentNumberConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  return (
    (Array.isArray(target) && target.includes("studentNo")) ||
    target === "Student_studentNo_key"
  );
}

const defaultDependencies: StudentServiceDependencies = {
  // Retrieves a bounded newest-first directory with only public student and class fields.
  findStudents: () =>
    prisma.student.findMany({
      take: 100,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: studentSelect,
    }),
  // Resolves only selected classes that are still active.
  findActiveClassIds: async (classIds) => {
    const classes = await prisma.class.findMany({
      where: {
        id: { in: classIds },
        archivedAt: null,
      },
      select: { id: true },
    });

    return classes.map((classRecord) => classRecord.id);
  },
  // Uses a nested write so the student and every enrollment succeed or fail together.
  insertStudent: async (data) => {
    try {
      return await prisma.student.create({
        data: {
          studentNo: data.studentNo,
          firstName: data.firstName,
          lastName: data.lastName,
          enrollments: {
            create: data.classIds.map((classId) => ({ classId })),
          },
        },
        select: studentSelect,
      });
    } catch (error) {
      if (isStudentNumberConflict(error)) {
        throw new StudentNumberConflictError();
      }

      throw error;
    }
  },
};

// Maps nested enrollment records to the stable public student representation.
function toStudentRecord(record: StudentDatabaseRecord): StudentRecord {
  const classes = record.enrollments
    .map((enrollment) => enrollment.class)
    .sort(
      (left, right) =>
        left.subjectName.localeCompare(right.subjectName) ||
        left.id.localeCompare(right.id),
    );

  return {
    id: record.id,
    studentNo: record.studentNo,
    firstName: record.firstName,
    lastName: record.lastName,
    classes,
  };
}

// Lists saved students through injectable dependencies for isolated testing.
export async function listStudents(
  dependencies: StudentServiceDependencies = defaultDependencies,
) {
  const students = await dependencies.findStudents();
  return students.map(toStudentRecord);
}

export type CreateStudentResult =
  | { status: "created"; student: StudentRecord }
  | { status: "class_selection_unavailable" }
  | { status: "student_number_exists" };

// Validates active class membership and creates one student with all enrollments.
export async function createStudent(
  input: CreateStudentInput,
  dependencies: StudentServiceDependencies = defaultDependencies,
): Promise<CreateStudentResult> {
  const activeClassIds = await dependencies.findActiveClassIds(input.classIds);

  if (activeClassIds.length !== input.classIds.length) {
    return { status: "class_selection_unavailable" };
  }

  try {
    const createdStudent = await dependencies.insertStudent({
      studentNo: input.studentNo ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      classIds: input.classIds,
    });

    return {
      status: "created",
      student: toStudentRecord(createdStudent),
    };
  } catch (error) {
    if (error instanceof StudentNumberConflictError) {
      return { status: "student_number_exists" };
    }

    throw error;
  }
}
