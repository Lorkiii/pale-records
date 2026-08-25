-- Refuse the date-only conversion if existing timestamps would violate one session per class/date.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AttendanceSession"
    GROUP BY "classId", "sessionDate"::date
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'AttendanceSession contains duplicate class/calendar-date combinations';
  END IF;
END $$;

-- Snapshot matched schedule times on the session and persist Excused remarks per record.
ALTER TABLE "AttendanceSession"
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ALTER COLUMN "sessionDate" TYPE DATE USING "sessionDate"::date;

ALTER TABLE "AttendanceRecord"
  ADD COLUMN "remarks" VARCHAR(1000);

DROP INDEX "AttendanceSession_classId_sessionDate_idx";

CREATE UNIQUE INDEX "AttendanceSession_classId_sessionDate_key"
ON "AttendanceSession"("classId", "sessionDate");
