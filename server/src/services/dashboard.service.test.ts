// Verifies Dashboard aggregation, user scoping, no-data states, and collection bounds without a database.
import assert from "node:assert/strict";
import test from "node:test";

import {
  getDashboardOverview,
  type DashboardActiveClassRecord,
  type DashboardRecentUpdateCandidate,
  type DashboardServiceDependencies,
  type DashboardUpcomingEventRecord,
} from "./dashboard.service.js";
import {
  DASHBOARD_MAX_CLASS_SUMMARIES,
  DASHBOARD_MAX_RECENT_UPDATES,
  DASHBOARD_MAX_TODAY_SESSIONS,
  DASHBOARD_MAX_UPCOMING_EVENTS,
  dashboardOverviewDataSchema,
} from "../validations/dashboard.response.js";

const userId = "9f9ec0d6-811c-4cc5-9539-9ec5106e6672";
const firstClassId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const secondClassId = "be8bdd17-cf73-4b69-b295-ab1549329976";
const firstScheduleId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const firstEventId = "805a2580-d0b5-48a8-8eb3-9356e464b838";

function createDependencies(
  overrides: Partial<DashboardServiceDependencies> = {},
): DashboardServiceDependencies {
  return {
    findActiveClasses: async () => [],
    findActiveCounts: async () => ({
      enrolledStudentCount: 0,
      activeClassCount: 0,
    }),
    findAttendanceSummary: async () => ({
      currentMonth: { presentCount: 0, totalMarked: 0 },
      previousMonth: { presentCount: 0, totalMarked: 0 },
      classes: [],
      week: [],
    }),
    countUpcomingEvents: async () => 0,
    findUpcomingEvents: async () => [],
    findRecentUpdates: async () => [],
    ...overrides,
  };
}

const activeClasses: DashboardActiveClassRecord[] = [
  {
    id: firstClassId,
    subjectName: "Introduction to Computing",
    subjectCode: "CS101",
    section: "BSCS-1A",
    room: "CL-302",
    startDate: new Date("2026-08-24T00:00:00.000Z"),
    endDate: new Date("2026-12-18T00:00:00.000Z"),
    classSchedules: [{
      id: firstScheduleId,
      dayOfWeek: 3,
      startTime: "08:30",
      endTime: "10:00",
    }],
    attendanceSessions: [{
      rosterInitializedAt: new Date("2026-09-02T02:30:00.000Z"),
    }],
    _count: { enrollments: 38 },
  },
  {
    id: secondClassId,
    subjectName: "Data Structures and Algorithms",
    subjectCode: null,
    section: null,
    room: null,
    startDate: new Date("2026-09-03T00:00:00.000Z"),
    endDate: null,
    classSchedules: [{
      id: "1ff61a88-eed0-4bc9-a110-1efe7c6cf894",
      dayOfWeek: 3,
      startTime: "10:30",
      endTime: "12:00",
    }],
    attendanceSessions: [],
    _count: { enrollments: 20 },
  },
];

test("getDashboardOverview builds the persisted read model with fixed dependency calls", async () => {
  const calls = {
    classes: 0,
    counts: 0,
    attendance: 0,
    eventCount: 0,
    events: 0,
    updates: 0,
  };
  const dependencies = createDependencies({
    findActiveClasses: async (date, dayOfWeek, limit) => {
      calls.classes += 1;
      assert.deepEqual(date, new Date("2026-09-02T00:00:00.000Z"));
      assert.equal(dayOfWeek, 3);
      assert.equal(limit, DASHBOARD_MAX_CLASS_SUMMARIES);
      return activeClasses;
    },
    findActiveCounts: async () => {
      calls.counts += 1;
      return { enrolledStudentCount: 58, activeClassCount: 2 };
    },
    findAttendanceSummary: async (classIds, ranges) => {
      calls.attendance += 1;
      assert.deepEqual(classIds, [firstClassId, secondClassId]);
      assert.deepEqual(ranges, {
        week: {
          from: new Date("2026-08-31T00:00:00.000Z"),
          to: new Date("2026-09-04T00:00:00.000Z"),
        },
        currentMonth: {
          from: new Date("2026-09-01T00:00:00.000Z"),
          toExclusive: new Date("2026-10-01T00:00:00.000Z"),
        },
        previousMonth: {
          from: new Date("2026-08-01T00:00:00.000Z"),
          toExclusive: new Date("2026-09-01T00:00:00.000Z"),
        },
      });
      return {
        currentMonth: { presentCount: 8, totalMarked: 10 },
        previousMonth: { presentCount: 7, totalMarked: 10 },
        classes: [{
          classId: firstClassId,
          presentCount: 8,
          lateCount: 1,
          absentCount: 1,
          excusedCount: 0,
          totalMarked: 10,
        }],
        week: [{
          dateKey: new Date("2026-09-02T00:00:00.000Z"),
          presentCount: 8,
          lateCount: 1,
          absentCount: 1,
          excusedCount: 0,
          totalMarked: 10,
        }],
      };
    },
    countUpcomingEvents: async (receivedUserId, from, to) => {
      calls.eventCount += 1;
      assert.equal(receivedUserId, userId);
      assert.deepEqual(from, new Date("2026-09-02T00:00:00.000Z"));
      assert.deepEqual(to, new Date("2026-09-08T00:00:00.000Z"));
      return 4;
    },
    findUpcomingEvents: async (receivedUserId, from, to, limit) => {
      calls.events += 1;
      assert.equal(receivedUserId, userId);
      assert.deepEqual(from, new Date("2026-09-02T00:00:00.000Z"));
      assert.deepEqual(to, new Date("2026-09-08T00:00:00.000Z"));
      assert.equal(limit, DASHBOARD_MAX_UPCOMING_EVENTS);
      return [{
        id: firstEventId,
        title: "Midterm practical examination",
        eventDate: new Date("2026-09-04T00:00:00.000Z"),
        startTime: "09:00",
        completedAt: null,
        category: { shortCode: "EXAM", accentKey: "SIGNAL_RED" },
      }];
    },
    findRecentUpdates: async (receivedUserId, limit) => {
      calls.updates += 1;
      assert.equal(receivedUserId, userId);
      assert.equal(limit, DASHBOARD_MAX_RECENT_UPDATES);
      return [
        {
          entityId: firstEventId,
          type: "agenda",
          title: "Agenda event updated: Midterm practical examination",
          description: "EXAM scheduled for 2026-09-04.",
          occurredAt: new Date("2026-09-02T06:00:00.000Z"),
          classId: firstClassId,
          eventDate: new Date("2026-09-04T00:00:00.000Z"),
        },
        {
          entityId: firstScheduleId,
          type: "attendance",
          title: "Attendance recorded for CS101 (BSCS-1A)",
          description: "38 roster records initialized.",
          occurredAt: new Date("2026-09-02T06:15:00.000Z"),
          classId: firstClassId,
          eventDate: new Date("2026-09-02T00:00:00.000Z"),
        },
      ];
    },
  });

  const result = await getDashboardOverview(userId, "2026-09-02", dependencies);

  assert.deepEqual(calls, {
    classes: 1,
    counts: 1,
    attendance: 1,
    eventCount: 1,
    events: 1,
    updates: 1,
  });
  assert.deepEqual(result.kpis, {
    overallPresentRate: 80,
    changeVsPreviousMonth: 10,
    enrolledStudentCount: 58,
    activeClassCount: 2,
    upcomingEventCount: 4,
  });
  assert.deepEqual(result.todaySessions, [{
    id: firstScheduleId,
    classId: firstClassId,
    subjectCode: "CS101",
    subjectName: "Introduction to Computing",
    section: "BSCS-1A",
    room: "CL-302",
    startTime: "08:30",
    endTime: "10:00",
    enrolledCount: 38,
    attendanceCompleted: true,
  }]);
  assert.deepEqual(result.upcomingEvents, [{
    id: firstEventId,
    title: "Midterm practical examination",
    category: { shortCode: "EXAM", accentKey: "SIGNAL_RED" },
    eventDate: "2026-09-04",
    startTime: "09:00",
    isCompleted: false,
  }]);
  assert.deepEqual(result.classSummaries, [
    {
      classId: firstClassId,
      subjectCode: "CS101",
      subjectName: "Introduction to Computing",
      section: "BSCS-1A",
      enrolledCount: 38,
      presentRate: 80,
      lateRate: 10,
      absentRate: 10,
      excusedRate: 0,
      status: "moderate",
    },
    {
      classId: secondClassId,
      subjectCode: null,
      subjectName: "Data Structures and Algorithms",
      section: null,
      enrolledCount: 20,
      presentRate: null,
      lateRate: null,
      absentRate: null,
      excusedRate: null,
      status: null,
    },
  ]);
  assert.deepEqual(result.weeklyAttendance, {
    days: [
      { dayName: "MON", dateKey: "2026-08-31", presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, totalMarked: 0, presentRate: null },
      { dayName: "TUE", dateKey: "2026-09-01", presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, totalMarked: 0, presentRate: null },
      { dayName: "WED", dateKey: "2026-09-02", presentCount: 8, lateCount: 1, absentCount: 1, excusedCount: 0, totalMarked: 10, presentRate: 80 },
      { dayName: "THU", dateKey: "2026-09-03", presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, totalMarked: 0, presentRate: null },
      { dayName: "FRI", dateKey: "2026-09-04", presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, totalMarked: 0, presentRate: null },
    ],
    averagePresentRate: 80,
  });
  assert.deepEqual(result.recentUpdates.map((update) => update.type), [
    "attendance",
    "agenda",
  ]);
  assert.equal(dashboardOverviewDataSchema.safeParse(result).success, true);
});

test("getDashboardOverview preserves explicit empty attendance states", async () => {
  const result = await getDashboardOverview(
    userId,
    "2026-09-02",
    createDependencies(),
  );

  assert.deepEqual(result.kpis, {
    overallPresentRate: null,
    changeVsPreviousMonth: null,
    enrolledStudentCount: 0,
    activeClassCount: 0,
    upcomingEventCount: 0,
  });
  assert.deepEqual(result.todaySessions, []);
  assert.deepEqual(result.upcomingEvents, []);
  assert.deepEqual(result.classSummaries, []);
  assert.deepEqual(result.recentUpdates, []);
  assert.equal(result.weeklyAttendance.averagePresentRate, null);
  assert.equal(result.weeklyAttendance.days.length, 5);
  assert.equal(
    result.weeklyAttendance.days.every((day) =>
      day.totalMarked === 0 && day.presentRate === null),
    true,
  );
  assert.equal(dashboardOverviewDataSchema.safeParse(result).success, true);
});

function indexedUuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

test("getDashboardOverview defensively bounds every returned collection", async () => {
  const classRecords: DashboardActiveClassRecord[] = Array.from(
    { length: DASHBOARD_MAX_CLASS_SUMMARIES + 1 },
    (_, index) => ({
      id: indexedUuid(index),
      subjectName: `Subject ${index}`,
      subjectCode: `S${index}`,
      section: null,
      room: null,
      startDate: null,
      endDate: null,
      classSchedules: [{
        id: indexedUuid(index + 1_000),
        dayOfWeek: 3,
        startTime: "08:00",
        endTime: "09:00",
      }],
      attendanceSessions: [],
      _count: { enrollments: 0 },
    }),
  );
  const eventRecords: DashboardUpcomingEventRecord[] = Array.from(
    { length: DASHBOARD_MAX_UPCOMING_EVENTS + 1 },
    (_, index) => ({
      id: indexedUuid(index + 2_000),
      title: `Event ${index}`,
      eventDate: new Date("2026-09-04T00:00:00.000Z"),
      startTime: null,
      completedAt: null,
      category: { shortCode: "NOTE", accentKey: "INK" },
    }),
  );
  const updateRecords: DashboardRecentUpdateCandidate[] = Array.from(
    { length: DASHBOARD_MAX_RECENT_UPDATES + 1 },
    (_, index) => ({
      entityId: indexedUuid(index + 3_000),
      type: "class",
      title: `Class updated ${index}`,
      description: null,
      occurredAt: new Date(`2026-09-02T0${index}:00:00.000Z`),
      classId: null,
      eventDate: null,
    }),
  );
  const dependencies = createDependencies({
    findActiveClasses: async () => classRecords,
    findUpcomingEvents: async () => eventRecords,
    findRecentUpdates: async () => updateRecords,
  });

  const result = await getDashboardOverview(userId, "2026-09-02", dependencies);

  assert.equal(result.todaySessions.length, DASHBOARD_MAX_TODAY_SESSIONS);
  assert.equal(result.classSummaries.length, DASHBOARD_MAX_CLASS_SUMMARIES);
  assert.equal(result.upcomingEvents.length, DASHBOARD_MAX_UPCOMING_EVENTS);
  assert.equal(result.recentUpdates.length, DASHBOARD_MAX_RECENT_UPDATES);
  assert.equal(dashboardOverviewDataSchema.safeParse(result).success, true);
});
