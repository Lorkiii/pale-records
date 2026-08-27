ALTER TABLE "Student" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Student_active_createdAt_id_idx"
ON "Student"("createdAt" DESC, "id" ASC)
WHERE "archivedAt" IS NULL;
