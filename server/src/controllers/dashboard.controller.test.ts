// Verifies Dashboard overview validation, trusted-user flow, and safe error handling.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import {
  createDashboardControllerHandlers,
  type DashboardControllerDependencies,
} from "./dashboard.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validateQuery } from "../middleware/validate-query.js";
import { dashboardOverviewQuerySchema } from "../validations/dashboard.schema.js";
import type { DashboardOverviewData } from "../validations/dashboard.response.js";

const userId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const asOfDate = "2026-09-02";

// Creates one explicit empty weekday record without weakening its literal type.
function emptyWeekday(
  dayName: DashboardOverviewData["weeklyAttendance"]["days"][number]["dayName"],
  dateKey: string,
): DashboardOverviewData["weeklyAttendance"]["days"][number] {
  return {
    dayName,
    dateKey,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    excusedCount: 0,
    totalMarked: 0,
    presentRate: null,
  };
}

const emptyOverview: DashboardOverviewData = {
  asOfDate,
  kpis: {
    overallPresentRate: null,
    changeVsPreviousMonth: null,
    enrolledStudentCount: 0,
    activeClassCount: 0,
    upcomingEventCount: 0,
  },
  todaySessions: [],
  upcomingEvents: [],
  classSummaries: [],
  weeklyAttendance: {
    days: [
      emptyWeekday("MON", "2026-08-31"),
      emptyWeekday("TUE", "2026-09-01"),
      emptyWeekday("WED", "2026-09-02"),
      emptyWeekday("THU", "2026-09-03"),
      emptyWeekday("FRI", "2026-09-04"),
    ],
    averagePresentRate: null,
  },
  recentUpdates: [],
};

// Mounts the real query boundary around an injectable Dashboard controller.
function createTestApp(
  getOverview: DashboardControllerDependencies["getOverview"],
) {
  const handlers = createDashboardControllerHandlers({ getOverview });
  const testApp = express();
  testApp.use((_req, res, next) => {
    res.locals.authenticatedUser = {
      id: userId,
      firstName: "Ana",
      lastName: "Reyes",
      username: "ana.reyes",
      email: "ana@example.com",
    };
    next();
  });
  testApp.get(
    "/overview",
    validateQuery(dashboardOverviewQuerySchema),
    handlers.getDashboardOverviewController,
  );
  testApp.use(errorHandler);
  return testApp;
}

test("Dashboard overview returns its strict envelope using trusted request data", async () => {
  let receivedUserId = "";
  let receivedDate = "";
  const response = await request(createTestApp(async (trustedUserId, date) => {
    receivedUserId = trustedUserId;
    receivedDate = date;
    return emptyOverview;
  })).get(`/overview?date=${asOfDate}`);

  assert.equal(response.status, 200);
  assert.equal(receivedUserId, userId);
  assert.equal(receivedDate, asOfDate);
  assert.deepEqual(response.body, { success: true, data: emptyOverview });
});

test("Dashboard overview rejects invalid or unexpected query fields before service work", async () => {
  let callCount = 0;
  const testApp = createTestApp(async () => {
    callCount += 1;
    return emptyOverview;
  });
  const missingDate = await request(testApp).get("/overview");
  const invalidDate = await request(testApp).get("/overview?date=2026-02-30");
  const extraField = await request(testApp)
    .get(`/overview?date=${asOfDate}&userId=${userId}`);

  for (const response of [missingDate, invalidDate, extraField]) {
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal(callCount, 0);
});

test("Dashboard overview forwards unexpected service failures safely", async () => {
  const response = await request(createTestApp(async () => {
    throw new Error("private database detail");
  })).get(`/overview?date=${asOfDate}`);

  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(JSON.stringify(response.body).includes("private database detail"), false);
});
