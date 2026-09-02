// Verifies the Dashboard's bounded date windows, rounding, no-data, and status policies.
import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDashboardPresentRate,
  calculateDashboardRateChange,
  getDashboardAttendanceStatus,
  getDashboardDateRanges,
} from "./dashboard-metrics.js";

test("Dashboard present rates use marked records and round to one decimal place", () => {
  assert.equal(calculateDashboardPresentRate(98, 104), 94.2);
  assert.equal(calculateDashboardPresentRate(1, 3), 33.3);
  assert.equal(calculateDashboardPresentRate(0, 4), 0);
});

test("Dashboard present rates return null when no records are marked", () => {
  assert.equal(calculateDashboardPresentRate(0, 0), null);
});

test("Dashboard monthly change compares measured rates and preserves no-data states", () => {
  assert.equal(calculateDashboardRateChange(94.2, 92.4), 1.8);
  assert.equal(calculateDashboardRateChange(88.8, 90.1), -1.3);
  assert.equal(calculateDashboardRateChange(null, 90), null);
  assert.equal(calculateDashboardRateChange(90, null), null);
  assert.throws(() => calculateDashboardRateChange(101, 90), RangeError);
});

test("Dashboard present rates reject inconsistent aggregate counts", () => {
  for (const counts of [
    [-1, 4],
    [1.5, 4],
    [5, 4],
    [1, -1],
  ] as const) {
    assert.throws(
      () => calculateDashboardPresentRate(counts[0], counts[1]),
      RangeError,
    );
  }
});

test("Dashboard attendance status uses the agreed present-rate thresholds", () => {
  assert.equal(getDashboardAttendanceStatus(null), null);
  assert.equal(getDashboardAttendanceStatus(100), "optimal");
  assert.equal(getDashboardAttendanceStatus(90), "optimal");
  assert.equal(getDashboardAttendanceStatus(89.9), "moderate");
  assert.equal(getDashboardAttendanceStatus(80), "moderate");
  assert.equal(getDashboardAttendanceStatus(79.9), "at-risk");
  assert.equal(getDashboardAttendanceStatus(0), "at-risk");
});

test("Dashboard date ranges use the Monday-Friday week and a seven-day upcoming window", () => {
  assert.deepEqual(getDashboardDateRanges("2026-09-02"), {
    week: { from: "2026-08-31", to: "2026-09-04" },
    currentMonth: { from: "2026-09-01", toExclusive: "2026-10-01" },
    previousMonth: { from: "2026-08-01", toExclusive: "2026-09-01" },
    upcoming: { from: "2026-09-02", to: "2026-09-08" },
  });
});

test("Dashboard date ranges remain stable across a year boundary", () => {
  assert.deepEqual(getDashboardDateRanges("2027-01-01"), {
    week: { from: "2026-12-28", to: "2027-01-01" },
    currentMonth: { from: "2027-01-01", toExclusive: "2027-02-01" },
    previousMonth: { from: "2026-12-01", toExclusive: "2027-01-01" },
    upcoming: { from: "2027-01-01", to: "2027-01-07" },
  });
});

test("Dashboard date ranges reject dates outside the validated contract", () => {
  assert.throws(() => getDashboardDateRanges("2026-02-29"), RangeError);
  assert.throws(() => getDashboardDateRanges("September 2, 2026"), RangeError);
});
