// Defines the strict, bounded, and safe public contract for Dashboard overview data.
import { z } from "zod";

import {
  calculateDashboardPresentRate,
  getDashboardAttendanceStatus,
  getDashboardDateRanges,
} from "../services/dashboard-metrics.js";
import { agendaCategoryAccentKeySchema } from "./agenda-category.schema.js";
import { CLASS_SCHEDULE_TIME_PATTERN } from "./class.schema.js";
import { dashboardDateSchema } from "./dashboard.schema.js";

export const DASHBOARD_MAX_TODAY_SESSIONS = 100;
export const DASHBOARD_MAX_UPCOMING_EVENTS = 6;
export const DASHBOARD_MAX_CLASS_SUMMARIES = 100;
export const DASHBOARD_MAX_RECENT_UPDATES = 6;
const DASHBOARD_RATE_TOTAL_TENTHS = 1_000;
const DASHBOARD_RATE_ROUNDING_TOLERANCE_TENTHS = 2;

const dashboardCountSchema = z.number().int().nonnegative();
const dashboardPercentageSchema = z
  .number()
  .finite()
  .min(0)
  .max(100)
  .refine(
    (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
    "Percentages must use at most one decimal place",
  );
const dashboardPercentageChangeSchema = z
  .number()
  .finite()
  .min(-100)
  .max(100)
  .refine(
    (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
    "Percentage changes must use at most one decimal place",
  );
const dashboardNullablePercentageSchema = dashboardPercentageSchema.nullable();
const dashboardTimeSchema = z.string().regex(CLASS_SCHEDULE_TIME_PATTERN);
const dashboardNullableClassText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();

export const dashboardKpisSchema = z
  .strictObject({
    overallPresentRate: dashboardNullablePercentageSchema,
    changeVsPreviousMonth: dashboardPercentageChangeSchema.nullable(),
    enrolledStudentCount: dashboardCountSchema,
    activeClassCount: dashboardCountSchema,
    upcomingEventCount: dashboardCountSchema,
  })
  .superRefine((kpis, context) => {
    if (kpis.overallPresentRate === null && kpis.changeVsPreviousMonth !== null) {
      context.addIssue({
        code: "custom",
        path: ["changeVsPreviousMonth"],
        message: "A monthly change requires a current present rate",
      });
    }
  });

export const dashboardTodaySessionSchema = z
  .strictObject({
    id: z.string().uuid(),
    classId: z.string().uuid(),
    subjectCode: dashboardNullableClassText(32),
    subjectName: z.string().trim().min(1).max(120),
    section: dashboardNullableClassText(64),
    room: dashboardNullableClassText(64),
    startTime: dashboardTimeSchema,
    endTime: dashboardTimeSchema,
    enrolledCount: dashboardCountSchema,
    attendanceCompleted: z.boolean(),
  })
  .superRefine((session, context) => {
    if (session.endTime <= session.startTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Session end time must be later than start time",
      });
    }
  });

export const dashboardUpcomingEventSchema = z.strictObject({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  category: z.strictObject({
    shortCode: z.string().trim().min(1).max(12).regex(/^[A-Z0-9_-]+$/),
    accentKey: agendaCategoryAccentKeySchema,
  }),
  eventDate: dashboardDateSchema,
  startTime: dashboardTimeSchema.nullable(),
  isCompleted: z.boolean(),
});

export const dashboardClassSummarySchema = z
  .strictObject({
    classId: z.string().uuid(),
    subjectCode: dashboardNullableClassText(32),
    subjectName: z.string().trim().min(1).max(120),
    section: dashboardNullableClassText(64),
    enrolledCount: dashboardCountSchema,
    presentRate: dashboardNullablePercentageSchema,
    lateRate: dashboardNullablePercentageSchema,
    absentRate: dashboardNullablePercentageSchema,
    excusedRate: dashboardNullablePercentageSchema,
    status: z.enum(["optimal", "moderate", "at-risk"]).nullable(),
  })
  .superRefine((summary, context) => {
    const rates = [
      summary.presentRate,
      summary.lateRate,
      summary.absentRate,
      summary.excusedRate,
    ];
    const hasMeasuredRates = rates.every((rate) => rate !== null);
    const hasNoRates = rates.every((rate) => rate === null);

    if (!hasMeasuredRates && !hasNoRates) {
      context.addIssue({
        code: "custom",
        path: ["presentRate"],
        message: "Class attendance rates must all be measured or all be null",
      });
      return;
    }

    if (hasNoRates && summary.status !== null) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "A class without marked attendance cannot have a status",
      });
      return;
    }

    if (hasMeasuredRates) {
      const measuredRates = rates as [number, number, number, number];
      const totalRateTenths = measuredRates.reduce(
        (total, rate) => total + Math.round(rate * 10),
        0,
      );
      if (
        Math.abs(totalRateTenths - DASHBOARD_RATE_TOTAL_TENTHS) >
        DASHBOARD_RATE_ROUNDING_TOLERANCE_TENTHS
      ) {
        context.addIssue({
          code: "custom",
          path: ["presentRate"],
          message: "Measured class attendance rates must total 100 percent",
        });
      }

      const expectedStatus = getDashboardAttendanceStatus(summary.presentRate);
      if (summary.status !== expectedStatus) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: "Class status must match its present rate",
        });
      }
    }
  });

const dashboardWeekdayNameSchema = z.enum(["MON", "TUE", "WED", "THU", "FRI"]);

export const dashboardWeeklyAttendanceDaySchema = z
  .strictObject({
    dayName: dashboardWeekdayNameSchema,
    dateKey: dashboardDateSchema,
    presentCount: dashboardCountSchema,
    lateCount: dashboardCountSchema,
    absentCount: dashboardCountSchema,
    excusedCount: dashboardCountSchema,
    totalMarked: dashboardCountSchema,
    presentRate: dashboardNullablePercentageSchema,
  })
  .superRefine((day, context) => {
    const expectedTotal = day.presentCount +
      day.lateCount +
      day.absentCount +
      day.excusedCount;
    if (day.totalMarked !== expectedTotal) {
      context.addIssue({
        code: "custom",
        path: ["totalMarked"],
        message: "Total marked must equal the sum of status counts",
      });
      return;
    }

    const expectedRate = calculateDashboardPresentRate(
      day.presentCount,
      day.totalMarked,
    );
    if (day.presentRate !== expectedRate) {
      context.addIssue({
        code: "custom",
        path: ["presentRate"],
        message: "Daily present rate must match its marked counts",
      });
    }
  });

export const dashboardWeeklyAttendanceSchema = z
  .strictObject({
    days: z.array(dashboardWeeklyAttendanceDaySchema).length(5),
    averagePresentRate: dashboardNullablePercentageSchema,
  })
  .superRefine((weeklyAttendance, context) => {
    const expectedDayNames = ["MON", "TUE", "WED", "THU", "FRI"];
    weeklyAttendance.days.forEach((day, index) => {
      if (day.dayName !== expectedDayNames[index]) {
        context.addIssue({
          code: "custom",
          path: ["days", index, "dayName"],
          message: "Weekly attendance must be ordered Monday through Friday",
        });
      }
    });

    const presentCount = weeklyAttendance.days.reduce(
      (total, day) => total + day.presentCount,
      0,
    );
    const totalMarked = weeklyAttendance.days.reduce(
      (total, day) => total + day.totalMarked,
      0,
    );
    const expectedRate = calculateDashboardPresentRate(presentCount, totalMarked);
    if (weeklyAttendance.averagePresentRate !== expectedRate) {
      context.addIssue({
        code: "custom",
        path: ["averagePresentRate"],
        message: "Weekly present rate must use all marked weekday records",
      });
    }
  });

export const dashboardRecentUpdateSchema = z.strictObject({
  entityId: z.string().uuid(),
  type: z.enum(["attendance", "recitation", "agenda", "class", "student"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500).nullable(),
  occurredAt: z.iso.datetime(),
  classId: z.string().uuid().nullable(),
  eventDate: dashboardDateSchema.nullable(),
});

export const dashboardOverviewDataSchema = z
  .strictObject({
    asOfDate: dashboardDateSchema,
    kpis: dashboardKpisSchema,
    todaySessions: z
      .array(dashboardTodaySessionSchema)
      .max(DASHBOARD_MAX_TODAY_SESSIONS),
    upcomingEvents: z
      .array(dashboardUpcomingEventSchema)
      .max(DASHBOARD_MAX_UPCOMING_EVENTS),
    classSummaries: z
      .array(dashboardClassSummarySchema)
      .max(DASHBOARD_MAX_CLASS_SUMMARIES),
    weeklyAttendance: dashboardWeeklyAttendanceSchema,
    recentUpdates: z
      .array(dashboardRecentUpdateSchema)
      .max(DASHBOARD_MAX_RECENT_UPDATES),
  })
  .superRefine((overview, context) => {
    const ranges = getDashboardDateRanges(overview.asOfDate);
    const weekStart = new Date(`${ranges.week.from}T00:00:00.000Z`);

    overview.weeklyAttendance.days.forEach((day, index) => {
      const expectedDate = new Date(weekStart);
      expectedDate.setUTCDate(expectedDate.getUTCDate() + index);
      if (day.dateKey !== expectedDate.toISOString().slice(0, 10)) {
        context.addIssue({
          code: "custom",
          path: ["weeklyAttendance", "days", index, "dateKey"],
          message: "Weekly attendance dates must match the requested week",
        });
      }
    });

    overview.upcomingEvents.forEach((event, index) => {
      if (
        event.eventDate < ranges.upcoming.from ||
        event.eventDate > ranges.upcoming.to
      ) {
        context.addIssue({
          code: "custom",
          path: ["upcomingEvents", index, "eventDate"],
          message: "Upcoming events must be inside the seven-day window",
        });
      }
    });
  });

export type DashboardOverviewData = z.infer<typeof dashboardOverviewDataSchema>;

export const dashboardOverviewResponseSchema = z.strictObject({
  success: z.literal(true),
  data: dashboardOverviewDataSchema,
});
