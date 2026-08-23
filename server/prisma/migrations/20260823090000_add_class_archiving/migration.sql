ALTER TABLE "Class" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Class_active_createdAt_id_idx"
ON "Class"("createdAt" DESC, "id" ASC)
WHERE "archivedAt" IS NULL;
