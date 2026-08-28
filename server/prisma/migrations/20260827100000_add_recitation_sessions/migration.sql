-- CreateEnum
CREATE TYPE "RecitationMark" AS ENUM ('CHECK', 'X');

-- CreateTable
CREATE TABLE "RecitationSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "rosterInitializedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecitationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecitationRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mark" "RecitationMark",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecitationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecitationSession_classId_sessionDate_key"
ON "RecitationSession"("classId", "sessionDate");

-- CreateIndex
CREATE INDEX "RecitationRecord_studentId_idx"
ON "RecitationRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RecitationRecord_sessionId_studentId_key"
ON "RecitationRecord"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "RecitationSession"
ADD CONSTRAINT "RecitationSession_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationRecord"
ADD CONSTRAINT "RecitationRecord_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "RecitationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationRecord"
ADD CONSTRAINT "RecitationRecord_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
