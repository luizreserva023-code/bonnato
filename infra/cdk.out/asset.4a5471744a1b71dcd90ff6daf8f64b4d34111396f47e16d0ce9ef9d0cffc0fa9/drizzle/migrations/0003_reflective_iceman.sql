CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" varchar(96) NOT NULL,
	"eventType" varchar(48) NOT NULL,
	"occurredAt" timestamp DEFAULT now() NOT NULL,
	"storeId" integer NOT NULL,
	"sessionId" varchar(96) NOT NULL,
	"visitorId" varchar(96),
	"customerId" integer,
	"productId" integer,
	"categoryId" integer,
	"orderId" integer,
	"source" varchar(80),
	"utmSource" varchar(160),
	"utmMedium" varchar(160),
	"utmCampaign" varchar(200),
	"utmContent" varchar(200),
	"utmTerm" varchar(200),
	"deviceType" varchar(32) DEFAULT 'unknown' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_recommendation_dismissals" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"recommendationKey" varchar(220) NOT NULL,
	"ruleType" varchar(64) NOT NULL,
	"productId" integer,
	"categoryId" integer,
	"dismissedByUserId" integer,
	"dismissedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_events_event_uq" ON "analytics_events" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "analytics_events_store_event_occurred_idx" ON "analytics_events" USING btree ("storeId","eventType","occurredAt");--> statement-breakpoint
CREATE INDEX "analytics_events_store_session_occurred_idx" ON "analytics_events" USING btree ("storeId","sessionId","occurredAt");--> statement-breakpoint
CREATE INDEX "analytics_events_product_event_occurred_idx" ON "analytics_events" USING btree ("storeId","productId","eventType","occurredAt");--> statement-breakpoint
CREATE INDEX "analytics_events_category_event_occurred_idx" ON "analytics_events" USING btree ("storeId","categoryId","eventType","occurredAt");--> statement-breakpoint
CREATE INDEX "analytics_events_order_event_idx" ON "analytics_events" USING btree ("orderId","eventType");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_recommendation_dismissals_store_key_uq" ON "menu_recommendation_dismissals" USING btree ("storeId","recommendationKey");--> statement-breakpoint
CREATE INDEX "menu_recommendation_dismissals_product_idx" ON "menu_recommendation_dismissals" USING btree ("storeId","productId");--> statement-breakpoint
CREATE INDEX "menu_recommendation_dismissals_category_idx" ON "menu_recommendation_dismissals" USING btree ("storeId","categoryId");