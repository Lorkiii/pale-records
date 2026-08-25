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

const tuesdaySchedule = {
  id: "1b4a1b8f-2a16-4a83-98a3-3e772df4f700",
  dayOfWeek: 2,
  startTime: "09:00",
  endTime: "11:00",
};

const thursdaySchedule = {
  id: "34016b87-0f1a-412d-b6bf-a022b088aac0",
  dayOfWeek: 4,
  startTime: "08:00",
  endTime: "10:30",
};

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
  classSchedules: [thursdaySchedule, tuesdaySchedule],
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
      id: storedClass.id,
      subjectName: storedClass.subjectName,
      subjectCode: storedClass.subjectCode,
      section: storedClass.section,
      schoolYear: storedClass.schoolYear,
      semester: storedClass.semester,
      teacher: storedClass.teacher,
      room: storedClass.room,
      startDate: "2026-08-24",
      endDate: "2026-12-18",
      schedules: [tuesdaySchedule, thursdaySchedule],
    },
  ]);
});

// Confirms create operations map optional values and dates explicitly before persistence.
test("createClass explicitly maps optional values and UTC dates", async () => {
  let receivedData: Parameters<ClassServiceDependencies["insertClass"]>[0] | undefined;
  const dependencies = createDependencies({
    insertClass: async (data) => {
      receivedData = data;
      const { schedules, ...classData } = data;
      return {
        id: storedClass.id,
        ...classData,
        classSchedules: schedules.map((schedule, index) => ({
          id: index === 0 ? tuesdaySchedule.id : thursdaySchedule.id,
          ...schedule,
        })),
      };
    },
  });

  const result = await createClass(
    {
      subjectName: "Database Systems",
      subjectCode: "CS 321",
      startDate: "2026-08-24",
      schedules: [],
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
    schedules: [],
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
      return {
        ...storedClass,
        id: classId,
        subjectName: data.subjectName,
        endDate: data.endDate,
      };
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
  assert.deepEqual(result?.schedules, [tuesdaySchedule, thursdaySchedule]);

  const missingResult = await updateClass(
    storedClass.id,
    { subjectName: "Missing class" },
    createDependencies({ updateClassRecord: async () => null }),
  );
  assert.equal(missingResult, null);
});

// Confirms creation normalizes schedules and submits them with scalar data once.
test("createClass creates a class with ordered schedules atomically", async () => {
  let insertCalls = 0;
  let receivedSchedules: Parameters<ClassServiceDependencies["insertClass"]>[0]["schedules"] = [];
  const dependencies = createDependencies({
    insertClass: async (data) => {
      insertCalls += 1;
      receivedSchedules = data.schedules;
      return storedClass;
    },
  });

  await createClass({
    subjectName: "Database Systems",
    schedules: [
      { dayOfWeek: 4, startTime: "08:00", endTime: "10:30" },
      { dayOfWeek: 2, startTime: "09:00", endTime: "11:00" },
    ],
  }, dependencies);

  assert.equal(insertCalls, 1);
  assert.deepEqual(receivedSchedules.map((schedule) => schedule.dayOfWeek), [2, 4]);
});

// Confirms an omitted update schedule field remains omitted and preserves returned rows.
test("updateClass preserves schedules when schedules is omitted", async () => {
  let receivedSchedules: Parameters<ClassServiceDependencies["updateClassRecord"]>[1]["schedules"];
  const dependencies = createDependencies({
    updateClassRecord: async (_classId, data) => {
      receivedSchedules = data.schedules;
      return storedClass;
    },
  });

  const result = await updateClass(storedClass.id, {
    subjectName: "Advanced Database Systems",
  }, dependencies);

  assert.equal(receivedSchedules, undefined);
  assert.deepEqual(result?.schedules, [tuesdaySchedule, thursdaySchedule]);
});

// Confirms a supplied set can add, retime, and omit weekdays in one synchronization.
test("updateClass forwards the complete supplied weekly schedule set", async () => {
  let receivedSchedules: Parameters<ClassServiceDependencies["updateClassRecord"]>[1]["schedules"];
  const dependencies = createDependencies({
    updateClassRecord: async (_classId, data) => {
      receivedSchedules = data.schedules;
      return {
        ...storedClass,
        classSchedules: [
          { ...tuesdaySchedule, startTime: "10:00", endTime: "12:00" },
          {
            id: "a41b40ca-e790-4e1d-84fd-b184cb84be50",
            dayOfWeek: 5,
            startTime: "13:00",
            endTime: "15:00",
          },
        ],
      };
    },
  });

  const result = await updateClass(storedClass.id, {
    subjectName: "Database Systems",
    schedules: [
      { dayOfWeek: 5, startTime: "13:00", endTime: "15:00" },
      { dayOfWeek: 2, startTime: "10:00", endTime: "12:00" },
    ],
  }, dependencies);

  assert.deepEqual(receivedSchedules?.map((schedule) => schedule.dayOfWeek), [2, 5]);
  assert.equal(result?.schedules[0]?.startTime, "10:00");
  assert.deepEqual(result?.schedules.map((schedule) => schedule.dayOfWeek), [2, 5]);
});

// Confirms an explicit empty array reaches the atomic update operation unchanged.
test("updateClass removes all schedules when an empty array is supplied", async () => {
  let receivedSchedules: Parameters<ClassServiceDependencies["updateClassRecord"]>[1]["schedules"];
  const dependencies = createDependencies({
    updateClassRecord: async (_classId, data) => {
      receivedSchedules = data.schedules;
      return { ...storedClass, classSchedules: [] };
    },
  });

  const result = await updateClass(storedClass.id, {
    subjectName: "Database Systems",
    schedules: [],
  }, dependencies);

  assert.deepEqual(receivedSchedules, []);
  assert.deepEqual(result?.schedules, []);
});

// Confirms explicit public mapping does not leak additional database properties.
test("listClasses maps only safe public class and schedule fields", async () => {
  const internalClass = { ...storedClass, internalValue: "not public" };
  const result = await listClasses(createDependencies({
    findClasses: async () => [internalClass],
  }));

  assert.equal(Object.hasOwn(result[0] ?? {}, "internalValue"), false);
  assert.equal(Object.hasOwn(result[0] ?? {}, "classSchedules"), false);
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
