ALTER TABLE "client_notifications" ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE "scheduled_notifications" ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE "client_alerts" ADD COLUMN IF NOT EXISTS "imageUrl" text;
