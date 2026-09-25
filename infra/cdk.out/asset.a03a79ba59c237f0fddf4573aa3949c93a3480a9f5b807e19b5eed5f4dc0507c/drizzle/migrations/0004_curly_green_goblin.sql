ALTER TABLE "orders" ADD COLUMN "cancellationReasonCode" varchar(32);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellationReason" varchar(500);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelledByUserId" integer;