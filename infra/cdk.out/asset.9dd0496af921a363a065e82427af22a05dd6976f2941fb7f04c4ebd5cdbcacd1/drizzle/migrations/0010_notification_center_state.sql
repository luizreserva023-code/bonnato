ALTER TABLE "client_notifications" ADD COLUMN IF NOT EXISTS "dedupeKey" varchar(160);
ALTER TABLE "client_notifications" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
CREATE INDEX IF NOT EXISTS "client_notifications_user_archived_idx" ON "client_notifications" ("userId", "archivedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "client_notifications_dedupe_uq" ON "client_notifications" ("storeId", "userId", "dedupeKey");
