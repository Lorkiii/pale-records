-- CreateEnum
CREATE TYPE "UserPreferenceAttendanceState" AS ENUM ('PRESENT', 'UNRECORDED');

-- CreateEnum
CREATE TYPE "UserPreferenceTableDensity" AS ENUM ('COMFORTABLE', 'COMPACT');

-- CreateEnum
CREATE TYPE "UserPreferenceDateFormat" AS ENUM (
    'YEAR_MONTH_DAY',
    'DAY_MONTH_YEAR',
    'MONTH_DAY_YEAR'
);

-- CreateEnum
CREATE TYPE "UserPreferenceTimeFormat" AS ENUM ('TWELVE_HOUR', 'TWENTY_FOUR_HOUR');

-- CreateEnum
CREATE TYPE "UserPreferenceExportFormat" AS ENUM ('PDF', 'CSV');

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "defaultSchoolYear" VARCHAR(32),
    "defaultSemester" VARCHAR(32),
    "defaultAttendanceState" "UserPreferenceAttendanceState" NOT NULL DEFAULT 'UNRECORDED',
    "tableDensity" "UserPreferenceTableDensity" NOT NULL DEFAULT 'COMFORTABLE',
    "dateFormat" "UserPreferenceDateFormat" NOT NULL DEFAULT 'YEAR_MONTH_DAY',
    "timeFormat" "UserPreferenceTimeFormat" NOT NULL DEFAULT 'TWELVE_HOUR',
    "defaultExportFormat" "UserPreferenceExportFormat" NOT NULL DEFAULT 'PDF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPreference"
ADD CONSTRAINT "UserPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
