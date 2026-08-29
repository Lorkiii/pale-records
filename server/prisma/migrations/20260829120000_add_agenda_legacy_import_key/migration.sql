-- AlterTable
ALTER TABLE "AgendaEvent"
ADD COLUMN "legacyImportKey" VARCHAR(200);

-- CreateIndex
CREATE UNIQUE INDEX "AgendaEvent_legacyImportKey_key"
ON "AgendaEvent"("legacyImportKey");

-- AddCheckConstraint
ALTER TABLE "AgendaEvent"
ADD CONSTRAINT "AgendaEvent_legacyImportKey_not_blank"
CHECK ("legacyImportKey" IS NULL OR BTRIM("legacyImportKey") <> '');
