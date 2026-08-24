-- Normalize existing optional student numbers before enforcing uniqueness.
UPDATE "Student"
SET "studentNo" = NULLIF(UPPER(BTRIM("studentNo")), '')
WHERE "studentNo" IS NOT NULL;

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("studentId", "classId")
);

-- Preserve each student's current class assignment before removing Student.classId.
INSERT INTO "StudentEnrollment" ("studentId", "classId")
SELECT "id", "classId"
FROM "Student";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_classId_fkey";

-- DropIndex
DROP INDEX "Student_classId_lastName_firstName_idx";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "classId";

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNo_key" ON "Student"("studentNo");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "StudentEnrollment_classId_studentId_idx" ON "StudentEnrollment"("classId", "studentId");

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
