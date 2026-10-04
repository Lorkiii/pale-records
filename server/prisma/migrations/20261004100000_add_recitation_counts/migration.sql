-- Adds exact recitation counts while preserving original marks and unknown historical counts.
ALTER TABLE "RecitationRecord" ADD COLUMN "count" INTEGER DEFAULT 0;

UPDATE "RecitationRecord" SET "count" = NULL WHERE "mark" = 'CHECK';

ALTER TABLE "RecitationRecord" ADD CONSTRAINT "RecitationRecord_count_check"
CHECK (
  ("count" IS NOT NULL AND "count" >= 0)
  OR ("count" IS NULL AND "mark" IS NOT NULL AND "mark" = 'CHECK')
);
