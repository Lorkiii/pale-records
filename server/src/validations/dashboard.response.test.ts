// Verifies the Dashboard overview exposes only bounded, internally consistent public data.
import assert from "node:assert/strict";
import test from "node:test";

import {
  DASHBOARD_MAX_CLASS_SUMMARIES,
  DASHBOARD_MAX_RECENT_UPDATES,
  DASHBOARD_MAX_TODAY_SESSIONS,
  DASHBOARD_MAX_UPCOMING_EVENTS,
  dashboardOverviewResponseSchema,
} from "./dashboard.response.js";

const classId = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";
const scheduleId = "099aa026-ef03-4ab6-92ee-68fa37fb6523";
const eventId = "805a2580-d0b5-48a8-8eb3-9356e464b838";

const publicOverview = {
  success: true,
  data: {
    asOfDate: "2026-09-02",
    kpis: {
      overallPresentRate: 91.9,
      changeVsPreviousMonth: 1.8,
      enrolledStudentCount: 184,
      activeClassCount: 6,
      upcomingEventCount: 4,
    },
    todaySessions: [
      {
        id: scheduleId,
        classId,
        subjectCode: "CS101",
        subjectName: "Introduction to Computing",
        section: "BSCS-1A",
        room: "CL-302",
        startTime: "08:30",
        endTime: "10:00",
        enrolledCount: 38,
        attendanceCompleted: true,
      },
    ],
    upcomingEvents: [
      {
        id: eventId,
        title: "Midterm practical examination",
        category: {
          shortCode: "EXAM",
          accentKey: "SIGNAL_RED",
        },
        eventDate: "2026-09-04",
        startTime: "09:00",
        isCompleted: false,
      },
    ],
    classSummaries: [
      {
        classId,
        subjectCode: "CS101",
        subjectName: "Introduction to Computing",
        section: "BSCS-1A",
        enrolledCount: 38,
        presentRate: 94.2,
        lateRate: 2.9,
        absentRate: 1.9,
        excusedRate: 1,
        status: "optimal",
      },
    ],
    weeklyAttendance: {
      days: [
        { dayName: "MON", dateKey: "2026-08-31", presentCount: 92, lateCount: 4, absentCount: 3, excusedCount: 1, totalMarked: 100, presentRate: 92 },
        { dayName: "TUE", dateKey: "2026-09-01", presentCount: 68, lateCount: 2, absentCount: 1, excusedCount: 1, totalMarked: 72, presentRate: 94.4 },
        { dayName: "WED", dateKey: "2026-09-02", presentCount: 98, lateCount: 3, absentCount: 2, excusedCount: 1, totalMarked: 104, presentRate: 94.2 },
        { dayName: "THU", dateKey: "2026-09-03", presentCount: 65, lateCount: 4, absentCount: 2, excusedCount: 1, totalMarked: 72, presentRate: 90.3 },
        { dayName: "FRI", dateKey: "2026-09-04", presentCount: 88, lateCount: 5, absentCount: 4, excusedCount: 2, totalMarked: 99, presentRate: 88.9 },
      ],
      averagePresentRate: 91.9,
    },
    recentUpdates: [
      {
        entityId: scheduleId,
        type: "attendance",
        title: "Attendance updated for CS101",
        description: "38 roster records were saved.",
        occurredAt: "2026-09-02T06:15:00.000Z",
        classId,
        eventDate: "2026-09-02",
      },
    ],
  },
} as const;

test("Dashboard overview accepts the exact documented public response", () => {
  assert.deepEqual(
    dashboardOverviewResponseSchema.parse(publicOverview),
    publicOverview,
  );
});

test("Dashboard overview rejects internal, sensitive, and client-routing fields", () => {
  const unsafeValues = [
    {
      ...publicOverview,
      data: { ...publicOverview.data, userId: classId },
    },
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        upcomingEvents: [{ ...publicOverview.data.upcomingEvents[0], userId: classId }],
      },
    },
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        recentUpdates: [{ ...publicOverview.data.recentUpdates[0], targetLink: "/dashboard/attendance" }],
      },
    },
    {
      ...publicOverview,
      data: { ...publicOverview.data, passwordHash: "private" },
    },
  ];

  for (const unsafeValue of unsafeValues) {
    assert.equal(dashboardOverviewResponseSchema.safeParse(unsafeValue).success, false);
  }
});

test("Dashboard overview accepts explicit no-data attendance states", () => {
  const noDataOverview = {
    ...publicOverview,
    data: {
      ...publicOverview.data,
      kpis: {
        ...publicOverview.data.kpis,
        overallPresentRate: null,
        changeVsPreviousMonth: null,
      },
      classSummaries: [
        {
          ...publicOverview.data.classSummaries[0],
          presentRate: null,
          lateRate: null,
          absentRate: null,
          excusedRate: null,
          status: null,
        },
      ],
      weeklyAttendance: {
        days: publicOverview.data.weeklyAttendance.days.map((day) => ({
          ...day,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0,
          totalMarked: 0,
          presentRate: null,
        })),
        averagePresentRate: null,
      },
    },
  };

  assert.equal(dashboardOverviewResponseSchema.safeParse(noDataOverview).success, true);
});

test("Dashboard overview accepts the full two-tenths status rounding tolerance", () => {
  const roundedOverview = {
    ...publicOverview,
    data: {
      ...publicOverview.data,
      classSummaries: [{
        ...publicOverview.data.classSummaries[0],
        presentRate: 6.3,
        lateRate: 18.8,
        absentRate: 6.3,
        excusedRate: 68.8,
        status: "at-risk",
      }],
    },
  };

  assert.equal(
    dashboardOverviewResponseSchema.safeParse(roundedOverview).success,
    true,
  );
});

test("Dashboard overview rejects inconsistent attendance calculations", () => {
  const inconsistentValues = [
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        classSummaries: [{
          ...publicOverview.data.classSummaries[0],
          status: "moderate",
        }],
      },
    },
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        classSummaries: [{
          ...publicOverview.data.classSummaries[0],
          lateRate: null,
        }],
      },
    },
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        classSummaries: [{
          ...publicOverview.data.classSummaries[0],
          absentRate: 4,
        }],
      },
    },
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        weeklyAttendance: {
          ...publicOverview.data.weeklyAttendance,
          days: publicOverview.data.weeklyAttendance.days.map((day, index) => (
            index === 0 ? { ...day, totalMarked: 99 } : day
          )),
        },
      },
    },
    {
      ...publicOverview,
      data: {
        ...publicOverview.data,
        weeklyAttendance: {
          ...publicOverview.data.weeklyAttendance,
          averagePresentRate: 92,
        },
      },
    },
  ];

  for (const inconsistentValue of inconsistentValues) {
    assert.equal(
      dashboardOverviewResponseSchema.safeParse(inconsistentValue).success,
      false,
    );
  }
});

test("Dashboard overview requires the requested week and upcoming date window", () => {
  const wrongWeek = {
    ...publicOverview,
    data: {
      ...publicOverview.data,
      weeklyAttendance: {
        ...publicOverview.data.weeklyAttendance,
        days: publicOverview.data.weeklyAttendance.days.map((day, index) => (
          index === 0 ? { ...day, dateKey: "2026-08-24" } : day
        )),
      },
    },
  };
  const eventOutsideWindow = {
    ...publicOverview,
    data: {
      ...publicOverview.data,
      upcomingEvents: [{
        ...publicOverview.data.upcomingEvents[0],
        eventDate: "2026-09-09",
      }],
    },
  };

  assert.equal(dashboardOverviewResponseSchema.safeParse(wrongWeek).success, false);
  assert.equal(dashboardOverviewResponseSchema.safeParse(eventOutsideWindow).success, false);
});

test("Dashboard overview keeps every collection bounded", () => {
  const listCases = [
    ["todaySessions", DASHBOARD_MAX_TODAY_SESSIONS, publicOverview.data.todaySessions[0]],
    ["upcomingEvents", DASHBOARD_MAX_UPCOMING_EVENTS, publicOverview.data.upcomingEvents[0]],
    ["classSummaries", DASHBOARD_MAX_CLASS_SUMMARIES, publicOverview.data.classSummaries[0]],
    ["recentUpdates", DASHBOARD_MAX_RECENT_UPDATES, publicOverview.data.recentUpdates[0]],
  ] as const;

  for (const [field, maximum, item] of listCases) {
    const identityField = field === "recentUpdates"
      ? "entityId"
      : field === "classSummaries"
        ? "classId"
        : "id";
    const items = Array.from({ length: maximum + 1 }, (_, index) => ({
      ...item,
      [identityField]: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    }));

    assert.equal(dashboardOverviewResponseSchema.safeParse({
      ...publicOverview,
      data: { ...publicOverview.data, [field]: items },
    }).success, false);
  }
});
