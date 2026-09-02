// Builds the bounded Dashboard overview read model from persisted PALE records.
import {
  Prisma,
  type AgendaCategoryAccentKey,
} from "../generated/prisma/client.js";
import prisma from "../lib/db-client.js";
import type { DashboardOverviewData } from "../validations/dashboard.response.js";
import {
  DASHBOARD_MAX_CLASS_SUMMARIES,
  DASHBOARD_MAX_RECENT_UPDATES,
  DASHBOARD_MAX_TODAY_SESSIONS,
  DASHBOARD_MAX_UPCOMING_EVENTS,
} from "../validations/dashboard.response.js";
import {
  calculateDashboardPresentRate,
  calculateDashboardRateChange,
  getDashboardAttendanceStatus,
  getDashboardDateRanges,
  type DashboardDateRanges,
} from "./dashboard-metrics.js";

type DashboardDatabaseDateRanges = {
  week: { from: Date; to: Date };
  currentMonth: { from: Date; toExclusive: Date };
  previousMonth: { from: Date; toExclusive: Date };
};

export type DashboardActiveClassRecord = {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
  room: string | null;
  startDate: Date | null;
  endDate: Date | null;
  classSchedules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  attendanceSessions: Array<{ rosterInitializedAt: Date | null }>;
  _count: { enrollments: number };
};

export type DashboardAttendanceCounts = {
  presentCount: number;
  totalMarked: number;
};

export type DashboardAttendanceStatusCounts = DashboardAttendanceCounts & {
  lateCount: number;
  absentCount: number;
  excusedCount: number;
};

export type DashboardClassAttendanceCounts = DashboardAttendanceStatusCounts & {
  classId: string;
};

export type DashboardWeeklyAttendanceCounts = DashboardAttendanceStatusCounts & {
  dateKey: Date;
};

export type DashboardAttendanceSummary = {
  currentMonth: DashboardAttendanceCounts;
  previousMonth: DashboardAttendanceCounts;
  classes: DashboardClassAttendanceCounts[];
  week: DashboardWeeklyAttendanceCounts[];
};

export type DashboardUpcomingEventRecord = {
  id: string;
  title: string;
  eventDate: Date;
  startTime: string | null;
  completedAt: Date | null;
  category: {
    shortCode: string;
    accentKey: AgendaCategoryAccentKey;
  };
};

export type DashboardRecentUpdateCandidate = {
  entityId: string;
  type: DashboardOverviewData["recentUpdates"][number]["type"];
  title: string;
  description: string | null;
  occurredAt: Date;
  classId: string | null;
  eventDate: Date | null;
};

export type DashboardServiceDependencies = {
  findActiveClasses: (
    asOfDate: Date,
    dayOfWeek: number,
    limit: number,
  ) => Promise<DashboardActiveClassRecord[]>;
  findActiveCounts: () => Promise<{
    enrolledStudentCount: number;
    activeClassCount: number;
  }>;
  findAttendanceSummary: (
    classIds: string[],
    ranges: DashboardDatabaseDateRanges,
  ) => Promise<DashboardAttendanceSummary>;
  countUpcomingEvents: (
    userId: string,
    from: Date,
    to: Date,
  ) => Promise<number>;
  findUpcomingEvents: (
    userId: string,
    from: Date,
    to: Date,
    limit: number,
  ) => Promise<DashboardUpcomingEventRecord[]>;
  findRecentUpdates: (
    userId: string,
    limit: number,
  ) => Promise<DashboardRecentUpdateCandidate[]>;
};

const attendanceStatusCountSql = Prisma.sql`
  COUNT(*) FILTER (WHERE ar."status" = 'PRESENT')::integer AS "presentCount",
  COUNT(*) FILTER (WHERE ar."status" = 'LATE')::integer AS "lateCount",
  COUNT(*) FILTER (WHERE ar."status" = 'ABSENT')::integer AS "absentCount",
  COUNT(*) FILTER (WHERE ar."status" = 'EXCUSED')::integer AS "excusedCount",
  COUNT(*)::integer AS "totalMarked"
`;

// Converts trusted date-only values to the UTC dates expected by PostgreSQL date columns.
function toDatabaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDatabaseDateRanges(ranges: DashboardDateRanges): DashboardDatabaseDateRanges {
  return {
    week: {
      from: toDatabaseDate(ranges.week.from),
      to: toDatabaseDate(ranges.week.to),
    },
    currentMonth: {
      from: toDatabaseDate(ranges.currentMonth.from),
      toExclusive: toDatabaseDate(ranges.currentMonth.toExclusive),
    },
    previousMonth: {
      from: toDatabaseDate(ranges.previousMonth.from),
      toExclusive: toDatabaseDate(ranges.previousMonth.toExclusive),
    },
  };
}

function truncateDashboardText(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trimEnd()}…`;
}

function classDisplayName(record: {
  subjectName: string;
  subjectCode: string | null;
  section: string | null;
}) {
  const subject = record.subjectCode ?? record.subjectName;
  return record.section ? `${subject} (${record.section})` : subject;
}

function describeRecordCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// Uses the stable session-initialization timestamp because PALE has no audit-log model.
async function findRecentUpdateCandidates(
  userId: string,
  limit: number,
): Promise<DashboardRecentUpdateCandidate[]> {
  const [attendance, recitation, agenda, classes, students] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { rosterInitializedAt: { not: null } },
      take: limit,
      orderBy: [{ rosterInitializedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        classId: true,
        sessionDate: true,
        rosterInitializedAt: true,
        class: {
          select: { subjectName: true, subjectCode: true, section: true },
        },
        _count: { select: { attendanceRecords: true } },
      },
    }),
    prisma.recitationSession.findMany({
      where: { rosterInitializedAt: { not: null } },
      take: limit,
      orderBy: [{ rosterInitializedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        classId: true,
        sessionDate: true,
        rosterInitializedAt: true,
        class: {
          select: { subjectName: true, subjectCode: true, section: true },
        },
        _count: { select: { recitationRecords: true } },
      },
    }),
    prisma.agendaEvent.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        classId: true,
        eventDate: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { shortCode: true } },
      },
    }),
    prisma.class.findMany({
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        subjectName: true,
        subjectCode: true,
        section: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.student.findMany({
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            enrollments: { where: { class: { archivedAt: null } } },
          },
        },
      },
    }),
  ]);

  const attendanceUpdates: DashboardRecentUpdateCandidate[] = attendance.flatMap(
    (session) => session.rosterInitializedAt === null
      ? []
      : [{
          entityId: session.id,
          type: "attendance" as const,
          title: `Attendance recorded for ${classDisplayName(session.class)}`,
          description: `${describeRecordCount(session._count.attendanceRecords, "roster record")} initialized.`,
          occurredAt: session.rosterInitializedAt,
          classId: session.classId,
          eventDate: session.sessionDate,
        }],
  );
  const recitationUpdates: DashboardRecentUpdateCandidate[] = recitation.flatMap(
    (session) => session.rosterInitializedAt === null
      ? []
      : [{
          entityId: session.id,
          type: "recitation" as const,
          title: `Recitation recorded for ${classDisplayName(session.class)}`,
          description: `${describeRecordCount(session._count.recitationRecords, "roster record")} initialized.`,
          occurredAt: session.rosterInitializedAt,
          classId: session.classId,
          eventDate: session.sessionDate,
        }],
  );
  const agendaUpdates: DashboardRecentUpdateCandidate[] = agenda.map((event) => ({
    entityId: event.id,
    type: "agenda",
    title: `${event.createdAt.getTime() === event.updatedAt.getTime() ? "Agenda event created" : "Agenda event updated"}: ${event.title}`,
    description: `${event.category.shortCode} scheduled for ${toDateOnly(event.eventDate)}.`,
    occurredAt: event.updatedAt,
    classId: event.classId,
    eventDate: event.eventDate,
  }));
  const classUpdates: DashboardRecentUpdateCandidate[] = classes.map((record) => ({
    entityId: record.id,
    type: "class",
    title: `${record.archivedAt ? "Class archived" : record.createdAt.getTime() === record.updatedAt.getTime() ? "Class created" : "Class updated"}: ${classDisplayName(record)}`,
    description: record.archivedAt
      ? "The class is no longer active."
      : "The class record was saved.",
    occurredAt: record.updatedAt,
    classId: record.id,
    eventDate: null,
  }));
  const studentUpdates: DashboardRecentUpdateCandidate[] = students.map((student) => ({
    entityId: student.id,
    type: "student",
    title: `${student.archivedAt ? "Student archived" : student.createdAt.getTime() === student.updatedAt.getTime() ? "Student created" : "Student updated"}: ${student.lastName}, ${student.firstName}`,
    description: student.archivedAt
      ? "The student is no longer active."
      : `${describeRecordCount(student._count.enrollments, "active class enrollment")}.`,
    occurredAt: student.updatedAt,
    classId: null,
    eventDate: null,
  }));

  return [
    ...attendanceUpdates,
    ...recitationUpdates,
    ...agendaUpdates,
    ...classUpdates,
    ...studentUpdates,
  ];
}

const defaultDependencies: DashboardServiceDependencies = {
  // One bounded class read supplies both directory and today's schedule data.
  findActiveClasses: (asOfDate, dayOfWeek, limit) =>
    prisma.class.findMany({
      where: { archivedAt: null },
      take: limit,
      orderBy: [{ subjectName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        subjectName: true,
        subjectCode: true,
        section: true,
        room: true,
        startDate: true,
        endDate: true,
        classSchedules: {
          where: { dayOfWeek },
          orderBy: { startTime: "asc" },
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
        attendanceSessions: {
          where: { sessionDate: asOfDate },
          take: 1,
          select: { rosterInitializedAt: true },
        },
        _count: {
          select: {
            enrollments: { where: { student: { archivedAt: null } } },
          },
        },
      },
    }),
  findActiveCounts: async () => {
    const [enrolledStudentCount, activeClassCount] = await Promise.all([
      prisma.student.count({
        where: {
          archivedAt: null,
          enrollments: { some: { class: { archivedAt: null } } },
        },
      }),
      prisma.class.count({ where: { archivedAt: null } }),
    ]);
    return { enrolledStudentCount, activeClassCount };
  },
  // Four aggregate queries keep monthly, class, and weekday work independent of class count.
  findAttendanceSummary: async (classIds, ranges) => {
    const classCountsPromise: Promise<DashboardClassAttendanceCounts[]> =
      classIds.length === 0
        ? Promise.resolve([])
        : prisma.$queryRaw<DashboardClassAttendanceCounts[]>(Prisma.sql`
            SELECT
              ats."classId" AS "classId",
              ${attendanceStatusCountSql}
            FROM "AttendanceRecord" ar
            JOIN "AttendanceSession" ats ON ats."id" = ar."sessionId"
            WHERE ats."classId" IN (${Prisma.join(classIds)})
              AND ats."sessionDate" >= ${ranges.currentMonth.from}
              AND ats."sessionDate" < ${ranges.currentMonth.toExclusive}
              AND ar."status" IS NOT NULL
            GROUP BY ats."classId"
          `);

    const [currentRows, previousRows, classCounts, week] = await Promise.all([
      prisma.$queryRaw<DashboardAttendanceCounts[]>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE ar."status" = 'PRESENT')::integer AS "presentCount",
          COUNT(*)::integer AS "totalMarked"
        FROM "AttendanceRecord" ar
        JOIN "AttendanceSession" ats ON ats."id" = ar."sessionId"
        JOIN "Class" c ON c."id" = ats."classId"
        WHERE c."archivedAt" IS NULL
          AND ats."sessionDate" >= ${ranges.currentMonth.from}
          AND ats."sessionDate" < ${ranges.currentMonth.toExclusive}
          AND ar."status" IS NOT NULL
      `),
      prisma.$queryRaw<DashboardAttendanceCounts[]>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE ar."status" = 'PRESENT')::integer AS "presentCount",
          COUNT(*)::integer AS "totalMarked"
        FROM "AttendanceRecord" ar
        JOIN "AttendanceSession" ats ON ats."id" = ar."sessionId"
        JOIN "Class" c ON c."id" = ats."classId"
        WHERE c."archivedAt" IS NULL
          AND ats."sessionDate" >= ${ranges.previousMonth.from}
          AND ats."sessionDate" < ${ranges.previousMonth.toExclusive}
          AND ar."status" IS NOT NULL
      `),
      classCountsPromise,
      prisma.$queryRaw<DashboardWeeklyAttendanceCounts[]>(Prisma.sql`
        SELECT
          ats."sessionDate" AS "dateKey",
          ${attendanceStatusCountSql}
        FROM "AttendanceRecord" ar
        JOIN "AttendanceSession" ats ON ats."id" = ar."sessionId"
        JOIN "Class" c ON c."id" = ats."classId"
        WHERE c."archivedAt" IS NULL
          AND ats."sessionDate" >= ${ranges.week.from}
          AND ats."sessionDate" <= ${ranges.week.to}
          AND ar."status" IS NOT NULL
        GROUP BY ats."sessionDate"
        ORDER BY ats."sessionDate" ASC
      `),
    ]);

    return {
      currentMonth: currentRows[0] ?? { presentCount: 0, totalMarked: 0 },
      previousMonth: previousRows[0] ?? { presentCount: 0, totalMarked: 0 },
      classes: classCounts,
      week,
    };
  },
  // The KPI counts only unfinished work, while the docket retains completed events.
  countUpcomingEvents: (userId, from, to) =>
    prisma.agendaEvent.count({
      where: { userId, eventDate: { gte: from, lte: to }, completedAt: null },
    }),
  findUpcomingEvents: (userId, from, to, limit) =>
    prisma.agendaEvent.findMany({
      where: { userId, eventDate: { gte: from, lte: to } },
      take: limit,
      orderBy: [
        { eventDate: "asc" },
        { startTime: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        title: true,
        eventDate: true,
        startTime: true,
        completedAt: true,
        category: { select: { shortCode: true, accentKey: true } },
      },
    }),
  findRecentUpdates: findRecentUpdateCandidates,
};

function isClassScheduledOnDate(record: DashboardActiveClassRecord, asOfDate: string) {
  const startsOnOrBefore = record.startDate === null ||
    toDateOnly(record.startDate) <= asOfDate;
  const endsOnOrAfter = record.endDate === null ||
    toDateOnly(record.endDate) >= asOfDate;
  return startsOnOrBefore && endsOnOrAfter;
}

function mapTodaySessions(
  classes: DashboardActiveClassRecord[],
  asOfDate: string,
): DashboardOverviewData["todaySessions"] {
  return classes
    .filter((record) => isClassScheduledOnDate(record, asOfDate))
    .flatMap((record) => record.classSchedules.map((schedule) => ({
      id: schedule.id,
      classId: record.id,
      subjectCode: record.subjectCode,
      subjectName: record.subjectName,
      section: record.section,
      room: record.room,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      enrolledCount: record._count.enrollments,
      attendanceCompleted: record.attendanceSessions.some(
        (session) => session.rosterInitializedAt !== null,
      ),
    })))
    .sort((first, second) =>
      first.startTime.localeCompare(second.startTime) ||
      first.subjectName.localeCompare(second.subjectName) ||
      first.id.localeCompare(second.id),
    )
    .slice(0, DASHBOARD_MAX_TODAY_SESSIONS);
}

function mapClassSummaries(
  classes: DashboardActiveClassRecord[],
  counts: DashboardClassAttendanceCounts[],
): DashboardOverviewData["classSummaries"] {
  const countsByClassId = new Map(counts.map((row) => [row.classId, row]));

  return classes.slice(0, DASHBOARD_MAX_CLASS_SUMMARIES).map((record) => {
    const row = countsByClassId.get(record.id);
    const totalMarked = row?.totalMarked ?? 0;
    const presentRate = calculateDashboardPresentRate(
      row?.presentCount ?? 0,
      totalMarked,
    );

    return {
      classId: record.id,
      subjectCode: record.subjectCode,
      subjectName: record.subjectName,
      section: record.section,
      enrolledCount: record._count.enrollments,
      presentRate,
      lateRate: calculateDashboardPresentRate(row?.lateCount ?? 0, totalMarked),
      absentRate: calculateDashboardPresentRate(row?.absentCount ?? 0, totalMarked),
      excusedRate: calculateDashboardPresentRate(row?.excusedCount ?? 0, totalMarked),
      status: getDashboardAttendanceStatus(presentRate),
    };
  });
}

const DASHBOARD_WEEKDAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI"] as const;

function mapWeeklyAttendance(
  ranges: DashboardDateRanges,
  rows: DashboardWeeklyAttendanceCounts[],
): DashboardOverviewData["weeklyAttendance"] {
  const rowsByDate = new Map(rows.map((row) => [toDateOnly(row.dateKey), row]));
  const weekStart = toDatabaseDate(ranges.week.from);
  const days = DASHBOARD_WEEKDAY_NAMES.map((dayName, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = toDateOnly(date);
    const row = rowsByDate.get(dateKey);
    const presentCount = row?.presentCount ?? 0;
    const lateCount = row?.lateCount ?? 0;
    const absentCount = row?.absentCount ?? 0;
    const excusedCount = row?.excusedCount ?? 0;
    const totalMarked = row?.totalMarked ?? 0;

    return {
      dayName,
      dateKey,
      presentCount,
      lateCount,
      absentCount,
      excusedCount,
      totalMarked,
      presentRate: calculateDashboardPresentRate(presentCount, totalMarked),
    };
  });
  const presentCount = days.reduce((total, day) => total + day.presentCount, 0);
  const totalMarked = days.reduce((total, day) => total + day.totalMarked, 0);

  return {
    days,
    averagePresentRate: calculateDashboardPresentRate(presentCount, totalMarked),
  };
}

function mapRecentUpdates(
  candidates: DashboardRecentUpdateCandidate[],
): DashboardOverviewData["recentUpdates"] {
  return candidates
    .sort((first, second) =>
      second.occurredAt.getTime() - first.occurredAt.getTime() ||
      first.type.localeCompare(second.type) ||
      first.entityId.localeCompare(second.entityId),
    )
    .slice(0, DASHBOARD_MAX_RECENT_UPDATES)
    .map((candidate) => ({
      entityId: candidate.entityId,
      type: candidate.type,
      title: truncateDashboardText(candidate.title, 160),
      description: candidate.description === null
        ? null
        : truncateDashboardText(candidate.description, 500),
      occurredAt: candidate.occurredAt.toISOString(),
      classId: candidate.classId,
      eventDate: candidate.eventDate === null ? null : toDateOnly(candidate.eventDate),
    }));
}

// Resolves one overview with a fixed number of reads rather than querying per class.
export async function getDashboardOverview(
  userId: string,
  asOfDate: string,
  dependencies: DashboardServiceDependencies = defaultDependencies,
): Promise<DashboardOverviewData> {
  const ranges = getDashboardDateRanges(asOfDate);
  const databaseRanges = toDatabaseDateRanges(ranges);
  const date = toDatabaseDate(asOfDate);
  const dayOfWeek = date.getUTCDay() || 7;
  const classes = await dependencies.findActiveClasses(
    date,
    dayOfWeek,
    DASHBOARD_MAX_CLASS_SUMMARIES,
  );
  const classIds = classes.map((record) => record.id);
  const [counts, attendance, upcomingEventCount, upcomingEvents, recentUpdates] =
    await Promise.all([
      dependencies.findActiveCounts(),
      dependencies.findAttendanceSummary(classIds, databaseRanges),
      dependencies.countUpcomingEvents(
        userId,
        toDatabaseDate(ranges.upcoming.from),
        toDatabaseDate(ranges.upcoming.to),
      ),
      dependencies.findUpcomingEvents(
        userId,
        toDatabaseDate(ranges.upcoming.from),
        toDatabaseDate(ranges.upcoming.to),
        DASHBOARD_MAX_UPCOMING_EVENTS,
      ),
      dependencies.findRecentUpdates(userId, DASHBOARD_MAX_RECENT_UPDATES),
    ]);
  const currentPresentRate = calculateDashboardPresentRate(
    attendance.currentMonth.presentCount,
    attendance.currentMonth.totalMarked,
  );
  const previousPresentRate = calculateDashboardPresentRate(
    attendance.previousMonth.presentCount,
    attendance.previousMonth.totalMarked,
  );

  return {
    asOfDate,
    kpis: {
      overallPresentRate: currentPresentRate,
      changeVsPreviousMonth: calculateDashboardRateChange(
        currentPresentRate,
        previousPresentRate,
      ),
      enrolledStudentCount: counts.enrolledStudentCount,
      activeClassCount: counts.activeClassCount,
      upcomingEventCount,
    },
    todaySessions: mapTodaySessions(classes, asOfDate),
    upcomingEvents: upcomingEvents
      .slice(0, DASHBOARD_MAX_UPCOMING_EVENTS)
      .map((event) => ({
        id: event.id,
        title: event.title,
        category: {
          shortCode: event.category.shortCode,
          accentKey: event.category.accentKey,
        },
        eventDate: toDateOnly(event.eventDate),
        startTime: event.startTime,
        isCompleted: event.completedAt !== null,
      })),
    classSummaries: mapClassSummaries(classes, attendance.classes),
    weeklyAttendance: mapWeeklyAttendance(ranges, attendance.week),
    recentUpdates: mapRecentUpdates(recentUpdates),
  };
}
