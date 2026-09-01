-- CreateEnum
CREATE TYPE "AgendaCategoryDefaultKey" AS ENUM (
    'EXAM',
    'ASSIGNMENT',
    'ACTIVITY',
    'HOLIDAY',
    'MEETING',
    'NOTE'
);

-- CreateEnum
CREATE TYPE "AgendaCategoryAccentKey" AS ENUM (
    'SIGNAL_RED',
    'SIGNAL_ORANGE',
    'SIGNAL_AMBER',
    'SIGNAL_YELLOW',
    'SIGNAL_GOLD',
    'SIGNAL_OCHRE',
    'SIGNAL_MUSTARD',
    'SIGNAL_EMERALD',
    'SIGNAL_TEAL',
    'SIGNAL_BLUE',
    'SIGNAL_PURPLE',
    'SIGNAL_ROSE',
    'INK',
    'INK_MUTED'
);

-- CreateTable
CREATE TABLE "AgendaCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultKey" "AgendaCategoryDefaultKey",
    "name" VARCHAR(120) NOT NULL,
    "shortCode" VARCHAR(12) NOT NULL,
    "accentKey" "AgendaCategoryAccentKey" NOT NULL,
    "description" VARCHAR(500),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaCategory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgendaCategory_name_not_blank" CHECK (BTRIM("name") <> ''),
    CONSTRAINT "AgendaCategory_shortCode_not_blank" CHECK (BTRIM("shortCode") <> ''),
    CONSTRAINT "AgendaCategory_shortCode_normalized" CHECK (
        "shortCode" = UPPER(BTRIM("shortCode"))
    ),
    CONSTRAINT "AgendaCategory_default_identity_consistent" CHECK (
        "isDefault" = ("defaultKey" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "AgendaCategory_userId_shortCode_key"
ON "AgendaCategory"("userId", "shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaCategory_userId_defaultKey_key"
ON "AgendaCategory"("userId", "defaultKey");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaCategory_id_userId_key"
ON "AgendaCategory"("id", "userId");

-- CreateIndex
CREATE INDEX "AgendaCategory_userId_isActive_name_idx"
ON "AgendaCategory"("userId", "isActive", "name");

-- AddForeignKey
ALTER TABLE "AgendaCategory"
ADD CONSTRAINT "AgendaCategory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed one canonical category set for every existing user. UUIDs are generated
-- explicitly because Prisma client defaults do not run for raw SQL inserts.
INSERT INTO "AgendaCategory" (
    "id",
    "userId",
    "defaultKey",
    "name",
    "shortCode",
    "accentKey",
    "description",
    "isDefault",
    "isActive",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    users."id",
    templates."defaultKey"::"AgendaCategoryDefaultKey",
    templates."name",
    templates."shortCode",
    templates."accentKey"::"AgendaCategoryAccentKey",
    templates."description",
    true,
    true,
    CURRENT_TIMESTAMP
FROM "User" AS users
CROSS JOIN (
    VALUES
        ('EXAM', 'Examination', 'EXAM', 'SIGNAL_RED', 'Major examinations, midterms, and finals.'),
        ('ASSIGNMENT', 'Assignment / Deadline', 'DEADLINE', 'SIGNAL_AMBER', 'Problem sets, essays, project submissions, and homework.'),
        ('ACTIVITY', 'Class Activity', 'ACTIVITY', 'SIGNAL_BLUE', 'Recitations, laboratory work, presentations, and group discussions.'),
        ('HOLIDAY', 'Academic Holiday', 'HOLIDAY', 'SIGNAL_EMERALD', 'Institutional breaks, national holidays, and official non-working days.'),
        ('MEETING', 'Faculty Meeting', 'MEETING', 'INK', 'Departmental meetings, college assemblies, and committee work.'),
        ('NOTE', 'General Note', 'NOTE', 'INK_MUTED', 'General academic reminders and notes.')
) AS templates("defaultKey", "name", "shortCode", "accentKey", "description");

-- AlterTable
ALTER TABLE "AgendaEvent"
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill every existing event to the matching default category owned by the
-- same user. No event rows or timestamps are recreated or rewritten.
UPDATE "AgendaEvent" AS events
SET "categoryId" = categories."id"
FROM "AgendaCategory" AS categories
WHERE categories."userId" = events."userId"
  AND categories."defaultKey"::text = events."eventType"::text;

-- Fail closed before making categoryId required or dropping historical type data.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "AgendaEvent" WHERE "categoryId" IS NULL) THEN
        RAISE EXCEPTION 'Agenda category backfill left events without a category';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "AgendaEvent"
ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AgendaEvent_categoryId_idx"
ON "AgendaEvent"("categoryId");

-- AddForeignKey
ALTER TABLE "AgendaEvent"
ADD CONSTRAINT "AgendaEvent_categoryId_userId_fkey"
FOREIGN KEY ("categoryId", "userId")
REFERENCES "AgendaCategory"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical eventType is no longer needed after the complete backfill.
ALTER TABLE "AgendaEvent" DROP COLUMN "eventType";

DROP TYPE "AgendaEventType";
