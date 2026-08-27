// Verifies student service mapping, enrollment saves, and archiving without a live database.
import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveStudent,
  createStudent,
  listStudents,
  StudentNumberConflictError,
  type StudentServiceDependencies,
  updateStudent,
} from "./student.service.js";

const firstClass = {
  id: "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0",
  subjectName: "Database Systems",
  subjectCode: "CS 321",
  section: "BSCS 3A",
};

const secondClass = {
  id: "55458380-0362-46bd-b3bb-cc6e880ab57e",
  subjectName: "Algorithms",
  subjectCode: "CS 212",
  section: "BSCS 2A",
};

const storedStudent = {
  id: "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c",
  studentNo: "AB-123",
  firstName: "Ana",
  lastName: "Reyes",
  enrollments: [{ class: firstClass }, { class: secondClass }],
};

// Creates deterministic service fakes while allowing each test to replace one behavior.
function createDependencies(
  overrides: Partial<StudentServiceDependencies> = {},
): StudentServiceDependencies {
  return {
    findStudents: async () => [],
    findActiveClassIds: async (classIds) => classIds,
    insertStudent: async () => storedStudent,
    updateStudentRecord: async () => storedStudent,
    markStudentArchived: async () => true,
    ...overrides,
  };
}

// Confirms nested enrollments become a sorted public classes collection.
test("listStudents maps enrollment records to public classes", async () => {
  const result = await listStudents(
    createDependencies({ findStudents: async () => [storedStudent] }),
  );

  assert.deepEqual(result, [
    {
      id: storedStudent.id,
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
      classes: [secondClass, firstClass],
    },
  ]);
});

// Confirms create maps only normalized identity fields and all selected class IDs.
test("createStudent explicitly maps one student with multiple classes", async () => {
  let receivedData:
    | Parameters<StudentServiceDependencies["insertStudent"]>[0]
    | undefined;
  const dependencies = createDependencies({
    insertStudent: async (data) => {
      receivedData = data;
      return storedStudent;
    },
  });

  const result = await createStudent(
    {
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id, secondClass.id],
    },
    dependencies,
  );

  assert.deepEqual(receivedData, {
    studentNo: "AB-123",
    firstName: "Ana",
    lastName: "Reyes",
    classIds: [firstClass.id, secondClass.id],
  });
  assert.equal(result.status, "created");
});

// Confirms a missing or archived class prevents every write.
test("createStudent rejects unavailable class selections before insertion", async () => {
  let insertWasCalled = false;
  const result = await createStudent(
    {
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id, secondClass.id],
    },
    createDependencies({
      findActiveClassIds: async () => [firstClass.id],
      insertStudent: async () => {
        insertWasCalled = true;
        return storedStudent;
      },
    }),
  );

  assert.deepEqual(result, { status: "class_selection_unavailable" });
  assert.equal(insertWasCalled, false);
});

// Confirms database uniqueness conflicts become an expected service result.
test("createStudent reports an existing student number", async () => {
  const result = await createStudent(
    {
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id],
    },
    createDependencies({
      insertStudent: async () => {
        throw new StudentNumberConflictError();
      },
    }),
  );

  assert.deepEqual(result, { status: "student_number_exists" });
});

// Confirms edit maps identity and replacement enrollment fields explicitly.
test("updateStudent replaces one active student's editable data", async () => {
  let receivedStudentId: string | undefined;
  let receivedData:
    | Parameters<StudentServiceDependencies["updateStudentRecord"]>[1]
    | undefined;
  const dependencies = createDependencies({
    updateStudentRecord: async (studentId, data) => {
      receivedStudentId = studentId;
      receivedData = data;
      return storedStudent;
    },
  });

  const result = await updateStudent(
    storedStudent.id,
    {
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id, secondClass.id],
    },
    dependencies,
  );

  assert.equal(receivedStudentId, storedStudent.id);
  assert.deepEqual(receivedData, {
    studentNo: "AB-123",
    firstName: "Ana",
    lastName: "Reyes",
    classIds: [firstClass.id, secondClass.id],
  });
  assert.equal(result.status, "updated");
});

// Confirms an archived or missing student is reported without fabricating a record.
test("updateStudent reports a missing active student", async () => {
  const result = await updateStudent(
    storedStudent.id,
    {
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id],
    },
    createDependencies({ updateStudentRecord: async () => null }),
  );

  assert.deepEqual(result, { status: "student_not_found" });
});

// Confirms edit rejects unavailable classes before changing the student.
test("updateStudent rejects unavailable class selections before update", async () => {
  let updateWasCalled = false;
  const result = await updateStudent(
    storedStudent.id,
    {
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id, secondClass.id],
    },
    createDependencies({
      findActiveClassIds: async () => [firstClass.id],
      updateStudentRecord: async () => {
        updateWasCalled = true;
        return storedStudent;
      },
    }),
  );

  assert.deepEqual(result, { status: "class_selection_unavailable" });
  assert.equal(updateWasCalled, false);
});

// Confirms edit returns the same safe uniqueness outcome as creation.
test("updateStudent reports an existing student number", async () => {
  const result = await updateStudent(
    storedStudent.id,
    {
      studentNo: "AB-123",
      firstName: "Ana",
      lastName: "Reyes",
      classIds: [firstClass.id],
    },
    createDependencies({
      updateStudentRecord: async () => {
        throw new StudentNumberConflictError();
      },
    }),
  );

  assert.deepEqual(result, { status: "student_number_exists" });
});

// Confirms archive supplies a trusted current timestamp to the persistence boundary.
test("archiveStudent supplies the archive timestamp", async () => {
  let receivedStudentId: string | undefined;
  let receivedArchivedAt: Date | undefined;
  const beforeArchive = Date.now();
  const result = await archiveStudent(
    storedStudent.id,
    createDependencies({
      markStudentArchived: async (studentId, archivedAt) => {
        receivedStudentId = studentId;
        receivedArchivedAt = archivedAt;
        return true;
      },
    }),
  );

  assert.equal(result, true);
  assert.equal(receivedStudentId, storedStudent.id);
  assert.ok(receivedArchivedAt);
  assert.ok(receivedArchivedAt.getTime() >= beforeArchive);
  assert.ok(receivedArchivedAt.getTime() <= Date.now());
});
