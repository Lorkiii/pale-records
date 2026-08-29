-- CreateEnum
CREATE TYPE "AgendaEventType" AS ENUM (
    'EXAM',
    'ASSIGNMENT',
    'ACTIVITY',
    'HOLIDAY',
    'MEETING',
    'NOTE'
);

-- CreateTable
CREATE TABLE "AgendaEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "eventDate" DATE NOT NULL,
    "startTime" VARCHAR(5),
    "endTime" VARCHAR(5),
    "isAllDay" BOOLEAN NOT NULL,
    "eventType" "AgendaEventType" NOT NULL,
    "location" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgendaEvent_title_not_blank" CHECK (BTRIM("title") <> ''),
    CONSTRAINT "AgendaEvent_startTime_valid" CHECK (
        "startTime" IS NULL
        OR "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT "AgendaEvent_endTime_valid" CHECK (
        "endTime" IS NULL
        OR "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT "AgendaEvent_allDay_times_null" CHECK (
        NOT "isAllDay"
        OR ("startTime" IS NULL AND "endTime" IS NULL)
    ),
    CONSTRAINT "AgendaEvent_time_range_valid" CHECK (
        "startTime" IS NULL
        OR "endTime" IS NULL
        OR "endTime" > "startTime"
    )
);

-- CreateIndex
CREATE INDEX "AgendaEvent_userId_eventDate_idx"
ON "AgendaEvent"("userId", "eventDate");

-- CreateIndex
CREATE INDEX "AgendaEvent_classId_idx"
ON "AgendaEvent"("classId");

-- AddForeignKey
ALTER TABLE "AgendaEvent"
ADD CONSTRAINT "AgendaEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaEvent"
ADD CONSTRAINT "AgendaEvent_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
