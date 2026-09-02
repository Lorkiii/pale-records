// Validates the local calendar date used to anchor one Dashboard overview request.
import { z } from "zod";

export const DASHBOARD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DASHBOARD_MIN_YEAR = 2000;
export const DASHBOARD_MAX_YEAR = 2100;

// Confirms the normalized value represents a real UTC calendar date.
function isRealCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(value);
}

export const dashboardDateSchema = z
  .string({ error: "Date is required" })
  .regex(DASHBOARD_DATE_PATTERN, "Use the YYYY-MM-DD date format")
  .refine(isRealCalendarDate, "Enter a valid calendar date");

const dashboardOverviewDateSchema = dashboardDateSchema.refine((value) => {
  const year = Number(value.slice(0, 4));
  return year >= DASHBOARD_MIN_YEAR && year <= DASHBOARD_MAX_YEAR;
}, `Enter a date from ${DASHBOARD_MIN_YEAR} through ${DASHBOARD_MAX_YEAR}`);

export const dashboardOverviewQuerySchema = z.strictObject({
  date: dashboardOverviewDateSchema,
});

export type DashboardOverviewQuery = z.infer<typeof dashboardOverviewQuerySchema>;
