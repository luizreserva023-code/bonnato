CREATE TABLE "event_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventKey" varchar(160) NOT NULL,
	"eventType" varchar(80) NOT NULL,
	"aggregateType" varchar(64) NOT NULL,
	"aggregateId" varchar(96) NOT NULL,
	"storeId" integer,
	"payload" text NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"availableAt" timestamp DEFAULT now() NOT NULL,
	"lockedAt" timestamp,
	"processedAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotencyKey" varchar(96) NOT NULL,
	"requestFingerprint" varchar(64) NOT NULL,
	"userId" integer NOT NULL,
	"storeId" integer NOT NULL,
	"status" varchar(24) DEFAULT 'processing' NOT NULL,
	"orderId" integer,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "orderNumber" varchar(40);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotencyKey" varchar(96);--> statement-breakpoint
UPDATE "orders"
SET "orderNumber" = 'BNT-' || LPAD(COALESCE("storeId", 0)::text, 2, '0') || '-' || LPAD("id"::text, 6, '0')
WHERE "orderNumber" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_outbox_event_key_uq" ON "event_outbox" USING btree ("eventKey");--> statement-breakpoint
CREATE INDEX "event_outbox_status_available_idx" ON "event_outbox" USING btree ("status","availableAt");--> statement-breakpoint
CREATE INDEX "event_outbox_aggregate_idx" ON "event_outbox" USING btree ("aggregateType","aggregateId");--> statement-breakpoint
CREATE INDEX "event_outbox_store_idx" ON "event_outbox" USING btree ("storeId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "order_requests_idempotency_uq" ON "order_requests" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "order_requests_user_store_idx" ON "order_requests" USING btree ("userId","storeId");--> statement-breakpoint
CREATE INDEX "order_requests_status_idx" ON "order_requests" USING btree ("status","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_uq" ON "orders" USING btree ("orderNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_uq" ON "orders" USING btree ("idempotencyKey");