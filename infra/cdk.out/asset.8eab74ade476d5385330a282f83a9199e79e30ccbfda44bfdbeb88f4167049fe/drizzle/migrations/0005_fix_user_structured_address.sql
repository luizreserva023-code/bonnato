CREATE TABLE IF NOT EXISTS "delivery_distance_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"minDistanceMeters" integer NOT NULL,
	"maxDistanceMeters" integer NOT NULL,
	"deliveryFeeCents" integer NOT NULL,
	"estimatedMinutes" integer NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_geocoding_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"addressKey" varchar(64) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"confidence" numeric(5, 4),
	"provider" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_route_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"routeKey" varchar(64) NOT NULL,
	"storeId" integer NOT NULL,
	"routeDistanceMeters" integer NOT NULL,
	"straightLineDistanceMeters" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_delivery_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"deliveryEnabled" boolean DEFAULT false NOT NULL,
	"maxDeliveryDistanceMeters" integer DEFAULT 0 NOT NULL,
	"originPostalCode" varchar(10),
	"originStreet" varchar(240),
	"originNumber" varchar(40),
	"originComplement" varchar(160),
	"originNeighborhood" varchar(160),
	"originCity" varchar(120),
	"originState" varchar(2),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"geocodedAddress" text,
	"geocodingProvider" varchar(64),
	"geocodedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryState" varchar(2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryLatitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryLongitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryStraightLineMeters" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryRouteDistanceMeters" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryDistanceMeters" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryEstimatedMinutes" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryDistanceZoneId" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryStoreLatitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryStoreLongitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryGeocodingProvider" varchar(64);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryRoutingProvider" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedStreet" varchar(240);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedNumber" varchar(40);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedComplement" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedNeighborhood" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedState" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedLatitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedLongitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedGeocodedAt" timestamp;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_distance_zones_storeId_stores_id_fk') THEN
    ALTER TABLE "delivery_distance_zones" ADD CONSTRAINT "delivery_distance_zones_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_route_cache_storeId_stores_id_fk') THEN
    ALTER TABLE "delivery_route_cache" ADD CONSTRAINT "delivery_route_cache_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_delivery_settings_storeId_stores_id_fk') THEN
    ALTER TABLE "store_delivery_settings" ADD CONSTRAINT "store_delivery_settings_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_distance_zones_store_idx" ON "delivery_distance_zones" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_distance_zones_store_active_sort_idx" ON "delivery_distance_zones" USING btree ("storeId","active","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_distance_zones_store_bounds_uq" ON "delivery_distance_zones" USING btree ("storeId","minDistanceMeters","maxDistanceMeters");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_geocoding_cache_key_uq" ON "delivery_geocoding_cache" USING btree ("addressKey");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_geocoding_cache_expires_idx" ON "delivery_geocoding_cache" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_route_cache_key_uq" ON "delivery_route_cache" USING btree ("routeKey");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_route_cache_store_idx" ON "delivery_route_cache" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_route_cache_expires_idx" ON "delivery_route_cache" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_delivery_settings_store_uq" ON "store_delivery_settings" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_delivery_settings_enabled_idx" ON "store_delivery_settings" USING btree ("deliveryEnabled");