// Verifies public Class responses require safe, ordered weekly schedule records.
import assert from "node:assert/strict";
import test from "node:test";

import {
  classCreateResponseSchema,
  classRecordSchema,
  classScheduleConflictResponseSchema,
  classUpdateResponseSchema,
} from "./class.response.js";

const baseClass = {
  id: "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0",
  subjectName: "Database Systems",
  subjectCode: "CS 321",
  section: "BSCS 3A",
  schoolYear: "2026-2027",
  semester: "First semester",
  teacher: "Maria Santos",
  room: "Laboratory 2",
  startDate: "2026-08-24",
  endDate: "2026-12-18",
};

const schedules = [
  {
    id: "1b4a1b8f-2a16-4a83-98a3-3e772df4f700",
    dayOfWeek: 2,
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: "34016b87-0f1a-412d-b6bf-a022b088aac0",
    dayOfWeek: 4,
    startTime: "08:00",
    endTime: "10:30",
  },
];

// Confirms the public response accepts only the required ordered schedule fields.
test("classRecordSchema accepts ordered public weekly schedules", () => {
  const result = classRecordSchema.parse({
    ...baseClass,
    schedules,
  });

  assert.equal(result.schedules.length, 2);
  assert.equal(result.schedules[1]?.endTime, "10:30");
});

// Confirms schedules are always present and reject internal or unsorted data.
test("classRecordSchema rejects missing, unknown, or unsorted schedule data", () => {
  assert.equal(classRecordSchema.safeParse(baseClass).success, false);
  assert.equal(classRecordSchema.safeParse({
    ...baseClass,
    schedules: [{
      id: "1b4a1b8f-2a16-4a83-98a3-3e772df4f700",
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "11:00",
      classId: baseClass.id,
    }],
  }).success, false);
  assert.equal(classRecordSchema.safeParse({
    ...baseClass,
    schedules: [
      {
        id: "34016b87-0f1a-412d-b6bf-a022b088aac0",
        dayOfWeek: 4,
        startTime: "08:00",
        endTime: "10:30",
      },
      {
        id: "1b4a1b8f-2a16-4a83-98a3-3e772df4f700",
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "11:00",
      },
    ],
  }).success, false);
});

// Confirms create and update controller envelopes expose the complete schedule set.
test("class write response schemas include weekly schedules", () => {
  const response = {
    success: true,
    data: { class: { ...baseClass, schedules } },
  } as const;

  assert.equal(classCreateResponseSchema.parse(response).data.class.schedules.length, 2);
  assert.equal(classUpdateResponseSchema.parse(response).data.class.schedules[1]?.dayOfWeek, 4);
});

test("class schedule conflicts use the safe expected error envelope", () => {
  const response = classScheduleConflictResponseSchema.parse({
    success: false,
    error: {
      code: "CLASS_SCHEDULE_CONFLICT",
      message: "A weekly schedule overlaps another active class.",
    },
  });

  assert.equal(response.error.code, "CLASS_SCHEDULE_CONFLICT");
});
