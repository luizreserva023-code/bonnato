ALTER TABLE "webhook_events"
  ADD COLUMN IF NOT EXISTS "status" varchar(24),
  ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "lastError" text,
  ADD COLUMN IF NOT EXISTS "lockedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;

UPDATE "webhook_events"
SET "status" = 'processed'
WHERE "status" IS NULL;

ALTER TABLE "webhook_events"
  ALTER COLUMN "status" SET DEFAULT 'processed',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "processedAt" DROP DEFAULT,
  ALTER COLUMN "processedAt" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "webhook_events_status_idx"
  ON "webhook_events" ("status", "updatedAt");
