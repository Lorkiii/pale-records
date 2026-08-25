-- Tracks completed class/month generation and distinguishes draft rosters from saved history.
ALTER TABLE "AttendanceSession"
ADD COLUMN "rosterInitializedAt" TIMESTAMP(3);

-- Every existing session was created together with its roster under the previous behavior.
UPDATE "AttendanceSession" AS session
SET "rosterInitializedAt" = session."createdAt"
WHERE EXISTS (
  SELECT 1
  FROM "AttendanceRecord" AS record
  WHERE record."sessionId" = session."id"
);

CREATE TABLE "AttendanceMonthGeneration" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "monthStart" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AttendanceMonthGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceMonthGeneration_classId_monthStart_key"
ON "AttendanceMonthGeneration"("classId", "monthStart");

ALTER TABLE "AttendanceMonthGeneration"
ADD CONSTRAINT "AttendanceMonthGeneration_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
