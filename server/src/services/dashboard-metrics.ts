// Defines pure Dashboard percentage, status, and calendar-window policies for later aggregation.
import {
  DASHBOARD_DATE_PATTERN,
  DASHBOARD_MAX_YEAR,
  DASHBOARD_MIN_YEAR,
} from "../validations/dashboard.schema.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type DashboardAttendanceStatus = "optimal" | "moderate" | "at-risk";

export type DashboardDateRanges = {
  week: { from: string; to: string };
  currentMonth: { from: string; toExclusive: string };
  previousMonth: { from: string; toExclusive: string };
  upcoming: { from: string; to: string };
};

// Rejects impossible internal counts before converting them into a public percentage.
function assertValidAttendanceCounts(presentCount: number, totalMarked: number) {
  if (
    !Number.isSafeInteger(presentCount) ||
    !Number.isSafeInteger(totalMarked) ||
    presentCount < 0 ||
    totalMarked < 0 ||
    presentCount > totalMarked
  ) {
    throw new RangeError("Dashboard attendance counts are inconsistent");
  }
}

// Returns a one-decimal present rate, preserving null as the honest no-data state.
export function calculateDashboardPresentRate(
  presentCount: number,
  totalMarked: number,
) {
  assertValidAttendanceCounts(presentCount, totalMarked);
  return totalMarked === 0
    ? null
    : Math.round((presentCount / totalMarked) * 1000) / 10;
}

// Returns the one-decimal percentage-point change only when both months have data.
export function calculateDashboardRateChange(
  currentRate: number | null,
  previousRate: number | null,
) {
  if (currentRate === null || previousRate === null) return null;
  for (const rate of [currentRate, previousRate]) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new RangeError("Dashboard present rate must be between 0 and 100");
    }
  }
  return Math.round((currentRate - previousRate) * 10) / 10;
}

// Classifies only measured present rates using the Dashboard's public thresholds.
export function getDashboardAttendanceStatus(
  presentRate: number | null,
): DashboardAttendanceStatus | null {
  if (presentRate === null) return null;
  if (!Number.isFinite(presentRate) || presentRate < 0 || presentRate > 100) {
    throw new RangeError("Dashboard present rate must be between 0 and 100");
  }
  if (presentRate >= 90) return "optimal";
  if (presentRate >= 80) return "moderate";
  return "at-risk";
}

// Parses only dates that already satisfy the public Dashboard query contract.
function toDashboardDate(value: string) {
  const year = Number(value.slice(0, 4));
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !DASHBOARD_DATE_PATTERN.test(value) ||
    year < DASHBOARD_MIN_YEAR ||
    year > DASHBOARD_MAX_YEAR ||
    Number.isNaN(date.getTime()) ||
    !date.toISOString().startsWith(value)
  ) {
    throw new RangeError("Dashboard date must satisfy the validated date contract");
  }
  return date;
}

// Produces a stable date-only value after UTC calendar arithmetic.
function formatDashboardDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Returns a new date shifted by complete calendar days without local-time conversion.
function shiftDashboardDate(date: Date, days: number) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

// Builds the fixed reporting windows anchored to the browser-supplied local date.
export function getDashboardDateRanges(asOfDate: string): DashboardDateRanges {
  const date = toDashboardDate(asOfDate);
  const isoDay = date.getUTCDay() || 7;
  const weekStart = shiftDashboardDate(date, -(isoDay - 1));
  const currentMonthStart = new Date(date);
  currentMonthStart.setUTCDate(1);
  const nextMonthStart = new Date(currentMonthStart);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const previousMonthStart = new Date(currentMonthStart);
  previousMonthStart.setUTCMonth(previousMonthStart.getUTCMonth() - 1);

  return {
    week: {
      from: formatDashboardDate(weekStart),
      to: formatDashboardDate(shiftDashboardDate(weekStart, 4)),
    },
    currentMonth: {
      from: formatDashboardDate(currentMonthStart),
      toExclusive: formatDashboardDate(nextMonthStart),
    },
    previousMonth: {
      from: formatDashboardDate(previousMonthStart),
      toExclusive: formatDashboardDate(currentMonthStart),
    },
    upcoming: {
      from: asOfDate,
      to: formatDashboardDate(shiftDashboardDate(date, 6)),
    },
  };
}
