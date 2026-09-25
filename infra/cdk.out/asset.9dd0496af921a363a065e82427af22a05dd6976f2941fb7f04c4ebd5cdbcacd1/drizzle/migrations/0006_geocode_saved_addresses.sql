ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "street" varchar(240);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "number" varchar(40);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "complement" varchar(160);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "neighborhood" varchar(160);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "state" varchar(2);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "geocodedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;