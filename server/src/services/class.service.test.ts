// Verifies class service mapping without requiring a live database.
import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveClass,
  createClass,
  listClasses,
  type ClassServiceDependencies,
  updateClass,
} from "./class.service.js";

const storedClass = {
  id: "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0",
  subjectName: "Database Systems",
  subjectCode: "CS 321",
  section: "BSCS 3A",
  schoolYear: "2026-2027",
  semester: "First semester",
  teacher: "Maria Santos",
  room: "Laboratory 2",
  startDate: new Date("2026-08-24T00:00:00.000Z"),
  endDate: new Date("2026-12-18T00:00:00.000Z"),
};

// Creates deterministic service fakes while allowing each test to replace one behavior.
function createDependencies(
  overrides: Partial<ClassServiceDependencies> = {},
): ClassServiceDependencies {
  return {
    findClasses: async () => [],
    insertClass: async () => storedClass,
    updateClassRecord: async () => storedClass,
    markClassArchived: async () => true,
    ...overrides,
  };
}

// Confirms database timestamps are exposed as stable date-only strings.
test("listClasses returns date-only safe records", async () => {
  const dependencies = createDependencies({
    findClasses: async () => [storedClass],
  });

  const result = await listClasses(dependencies);

  assert.deepEqual(result, [
    {
      ...storedClass,
      startDate: "2026-08-24",
      endDate: "2026-12-18",
    },
  ]);
});

// Confirms create operations map optional values and dates explicitly before persistence.
test("createClass explicitly maps optional values and UTC dates", async () => {
  let receivedData: Parameters<ClassServiceDependencies["insertClass"]>[0] | undefined;
  const dependencies = createDependencies({
    insertClass: async (data) => {
      receivedData = data;
      return { id: storedClass.id, ...data };
    },
  });

  const result = await createClass(
    {
      subjectName: "Database Systems",
      subjectCode: "CS 321",
      startDate: "2026-08-24",
    },
    dependencies,
  );

  assert.deepEqual(receivedData, {
    subjectName: "Database Systems",
    subjectCode: "CS 321",
    section: null,
    schoolYear: null,
    semester: null,
    teacher: null,
    room: null,
    startDate: new Date("2026-08-24T00:00:00.000Z"),
    endDate: null,
  });
  assert.equal(result.startDate, "2026-08-24");
  assert.equal(result.endDate, null);
});

// Confirms edit operations forward the ID and preserve the missing-record signal.
test("updateClass returns the updated safe record or null", async () => {
  let receivedClassId = "";
  const dependencies = createDependencies({
    updateClassRecord: async (classId, data) => {
      receivedClassId = classId;
      return { id: classId, ...data };
    },
  });

  const result = await updateClass(
    storedClass.id,
    {
      subjectName: "Advanced Database Systems",
      endDate: "2026-12-19",
    },
    dependencies,
  );

  assert.equal(receivedClassId, storedClass.id);
  assert.equal(result?.subjectName, "Advanced Database Systems");
  assert.equal(result?.endDate, "2026-12-19");

  const missingResult = await updateClass(
    storedClass.id,
    { subjectName: "Missing class" },
    createDependencies({ updateClassRecord: async () => null }),
  );
  assert.equal(missingResult, null);
});

// Confirms archive time comes from the trusted server rather than request input.
test("archiveClass records a server-generated archive time", async () => {
  let receivedClassId = "";
  let receivedArchivedAt: Date | undefined;
  const dependencies = createDependencies({
    markClassArchived: async (classId, archivedAt) => {
      receivedClassId = classId;
      receivedArchivedAt = archivedAt;
      return true;
    },
  });

  const result = await archiveClass(storedClass.id, dependencies);

  assert.equal(result, true);
  assert.equal(receivedClassId, storedClass.id);
  assert.equal(receivedArchivedAt instanceof Date, true);
});
