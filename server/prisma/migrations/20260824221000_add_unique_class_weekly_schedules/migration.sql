-- Stop with an explicit category before adding the weekly schedule constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ClassSchedule"
    GROUP BY "classId", "dayOfWeek"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ClassSchedule contains duplicate classId/dayOfWeek combinations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ClassSchedule"
    WHERE "dayOfWeek" < 1 OR "dayOfWeek" > 7
  ) THEN
    RAISE EXCEPTION 'ClassSchedule contains dayOfWeek values outside 1 through 7';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ClassSchedule"
    WHERE "startTime" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
       OR "endTime" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
  ) THEN
    RAISE EXCEPTION 'ClassSchedule contains malformed startTime or endTime values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ClassSchedule"
    WHERE "endTime" <= "startTime"
  ) THEN
    RAISE EXCEPTION 'ClassSchedule contains equal, reversed, or overnight time ranges';
  END IF;
END $$;

DROP INDEX "ClassSchedule_classId_dayOfWeek_idx";

CREATE UNIQUE INDEX "ClassSchedule_classId_dayOfWeek_key"
ON "ClassSchedule"("classId", "dayOfWeek");
