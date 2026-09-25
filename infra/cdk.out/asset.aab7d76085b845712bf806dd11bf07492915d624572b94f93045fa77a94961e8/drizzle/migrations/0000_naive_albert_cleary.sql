CREATE TABLE "abandoned_carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"userId" integer NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"customerPhone" varchar(30),
	"items" text NOT NULL,
	"total" varchar(20) NOT NULL,
	"orderId" integer,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"currentStep" integer DEFAULT 0 NOT NULL,
	"couponCode" varchar(60),
	"firstReminderSentAt" timestamp,
	"secondReminderSentAt" timestamp,
	"thirdReminderSentAt" timestamp,
	"recoveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_event_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"provider" varchar(32),
	"event" varchar(32) NOT NULL,
	"ipAddress" varchar(64),
	"userAgent" text,
	"metadataJson" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"type" varchar(60) NOT NULL,
	"userId" integer,
	"orderId" integer,
	"cartId" integer,
	"channel" varchar(32) NOT NULL,
	"step" integer,
	"status" varchar(32) NOT NULL,
	"abVariant" varchar(2),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"filterKey" varchar(80) NOT NULL,
	"operator" varchar(20) DEFAULT 'eq' NOT NULL,
	"value" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carousel_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"imageUrl" text NOT NULL,
	"title" varchar(200),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"imageUrl" text,
	"icon" varchar(64),
	"externalSource" varchar(32),
	"externalMerchantId" varchar(128),
	"externalId" varchar(128),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_alert_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"alertId" integer NOT NULL,
	"userId" integer NOT NULL,
	"readAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"icon" varchar(10) DEFAULT '🔔',
	"url" varchar(500),
	"storeId" integer,
	"active" boolean DEFAULT true NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"userId" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(32) DEFAULT 'system' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"userId" integer NOT NULL,
	"plan" varchar(32) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"pixCode" text,
	"pixQrCode" text,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_group_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"groupId" integer NOT NULL,
	"productId" integer NOT NULL,
	"sizeId" integer,
	"priceDelta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"comboId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"minSelections" integer DEFAULT 1 NOT NULL,
	"maxSelections" integer DEFAULT 1 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"couponId" integer NOT NULL,
	"code" varchar(50) NOT NULL,
	"orderId" integer NOT NULL,
	"userId" integer,
	"reverted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"code" varchar(50) NOT NULL,
	"externalSource" varchar(32),
	"externalMerchantId" varchar(128),
	"externalId" varchar(128),
	"discountType" varchar(32) NOT NULL,
	"discountValue" numeric(10, 2) NOT NULL,
	"minOrderValue" numeric(10, 2) DEFAULT '0',
	"maxUses" integer,
	"usedCount" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"userId" integer,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_customer_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"userId" integer NOT NULL,
	"tagId" integer NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#6b7280' NOT NULL,
	"description" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_auth_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"providerUserId" varchar(191) NOT NULL,
	"providerEmail" varchar(320),
	"providerPhone" varchar(20),
	"providerUsername" varchar(191),
	"displayName" varchar(255),
	"avatarUrl" text,
	"accountType" varchar(64),
	"accessTokenEncrypted" text,
	"refreshTokenEncrypted" text,
	"tokenExpiresAt" timestamp,
	"grantedScopes" text,
	"rawProfileJson" text,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"consentVersion" varchar(32),
	"consentedAt" timestamp,
	"linkedAt" timestamp DEFAULT now() NOT NULL,
	"lastSyncedAt" timestamp,
	"disconnectedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"firstOrderAt" timestamp,
	"lastOrderAt" timestamp,
	"totalOrders" integer DEFAULT 0 NOT NULL,
	"deliveredOrders" integer DEFAULT 0 NOT NULL,
	"cancelledOrders" integer DEFAULT 0 NOT NULL,
	"firstOrderCount" integer DEFAULT 0 NOT NULL,
	"totalSpent" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"averageTicket" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"favoriteNeighborhood" varchar(120),
	"favoriteOrderDay" varchar(20),
	"favoriteOrderHour" integer,
	"favoriteProductName" varchar(200),
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_store_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"userId" integer NOT NULL,
	"loyaltyPoints" integer DEFAULT 0 NOT NULL,
	"clubPlan" varchar(32),
	"clubStatus" varchar(32),
	"clubStartDate" timestamp,
	"clubNextBillingDate" timestamp,
	"clubFreePizzaUsed" boolean DEFAULT false NOT NULL,
	"clubFreePizzaResetAt" timestamp,
	"stripeCustomerId" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"userId" integer NOT NULL,
	"tag" varchar(32) NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"kind" varchar(32) DEFAULT 'delivery' NOT NULL,
	"predictionLabel" varchar(120) NOT NULL,
	"minMinutes" integer NOT NULL,
	"maxMinutes" integer NOT NULL,
	"prepBaseMinutes" integer DEFAULT 0 NOT NULL,
	"deliveryBaseMinutes" integer DEFAULT 0 NOT NULL,
	"queuePressure" integer DEFAULT 0 NOT NULL,
	"neighborhood" varchar(120),
	"method" varchar(80) DEFAULT 'heuristic' NOT NULL,
	"computedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"driverId" integer NOT NULL,
	"userId" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_ratings_orderId_unique" UNIQUE("orderId")
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"neighborhood" varchar(200) NOT NULL,
	"city" varchar(200) DEFAULT '' NOT NULL,
	"deliveryFee" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"estimatedMinutes" integer DEFAULT 45 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"name" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'free' NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"driverId" integer NOT NULL,
	"orderId" integer,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"driverId" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"name" varchar(200) NOT NULL,
	"phone" varchar(20),
	"accessToken" varchar(128) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_accessToken_unique" UNIQUE("accessToken")
);
--> statement-breakpoint
CREATE TABLE "external_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"channel" varchar(40) NOT NULL,
	"external_order_id" varchar(120) NOT NULL,
	"display_id" varchar(40) NOT NULL,
	"status" varchar(32) DEFAULT 'novo' NOT NULL,
	"customer_name" varchar(220) NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"productId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flavor_size_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"flavorId" integer NOT NULL,
	"productSizeId" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"cashbackPercent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"pointsPerReal" numeric(8, 3) DEFAULT '1' NOT NULL,
	"referralReferrerPoints" integer DEFAULT 100 NOT NULL,
	"referralReferredPoints" integer DEFAULT 50 NOT NULL,
	"npsEnabled" boolean DEFAULT true NOT NULL,
	"config" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ifood_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"merchant_id" varchar(120),
	"merchant_name" varchar(220),
	"status" varchar(32) DEFAULT 'disconnected' NOT NULL,
	"mode" varchar(32) DEFAULT 'mock' NOT NULL,
	"last_connected_at" timestamp,
	"last_sync_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ifood_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"action" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"name" varchar(160) NOT NULL,
	"category" varchar(120),
	"unit" varchar(32) NOT NULL,
	"currentStock" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"minimumStock" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"unitCost" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"supplier" varchar(160),
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'disconnected' NOT NULL,
	"config" text,
	"credentialsRef" varchar(191),
	"lastSuccessAt" timestamp,
	"lastFailureAt" timestamp,
	"lastError" text,
	"latencyMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"confidence" numeric(5, 2) DEFAULT '0' NOT NULL,
	"impactValue" numeric(12, 2),
	"payload" text,
	"status" varchar(32) DEFAULT 'new' NOT NULL,
	"validUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredientId" integer NOT NULL,
	"storeId" integer,
	"orderId" integer,
	"orderItemId" integer,
	"movementType" varchar(32) NOT NULL,
	"quantityDelta" numeric(12, 3) NOT NULL,
	"previousStock" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"nextStock" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"reason" varchar(255),
	"performedByUserId" integer,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"journeyId" integer NOT NULL,
	"userId" integer NOT NULL,
	"phone" varchar(30),
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"currentStep" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"nextStepAt" timestamp,
	"completedAt" timestamp,
	"lastMessageAt" timestamp,
	"convertedAt" timestamp,
	"conversionOrderId" integer,
	"logs" text,
	"abGroup" varchar(1),
	"adminTaskTitle" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"trigger" varchar(32) NOT NULL,
	"daysInactive" integer,
	"exitOnOrder" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"steps" text NOT NULL,
	"webhookToken" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"orderId" integer NOT NULL,
	"station" varchar(80) DEFAULT 'cozinha' NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"priority" varchar(32) DEFAULT 'normal' NOT NULL,
	"promisedAt" timestamp,
	"startedAt" timestamp,
	"readyAt" timestamp,
	"completedAt" timestamp,
	"printedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_order_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"orderId" integer NOT NULL,
	"userId" integer NOT NULL,
	"points" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"userId" integer NOT NULL,
	"orderId" integer,
	"type" varchar(32) NOT NULL,
	"points" integer NOT NULL,
	"description" varchar(255),
	"balanceBefore" integer NOT NULL,
	"balanceAfter" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"visitorId" varchar(96) NOT NULL,
	"sessionId" varchar(96) NOT NULL,
	"userId" integer,
	"utmSource" varchar(160),
	"utmMedium" varchar(160),
	"utmCampaign" varchar(200),
	"utmContent" varchar(200),
	"utmTerm" varchar(200),
	"fbclid" varchar(255),
	"gclid" varchar(255),
	"ttclid" varchar(255),
	"referrer" text,
	"landingPage" text,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" varchar(300),
	"imageUrl" text,
	"videoUrl" text,
	"badgeText" varchar(80),
	"ctaText" varchar(80),
	"ctaLink" varchar(500),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_size_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"modifierOptionId" integer NOT NULL,
	"productSizeId" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priceOverride" numeric(10, 2),
	"maxQuantityOverride" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multi_flavor_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"pricingRule" varchar(32) DEFAULT 'highest_price' NOT NULL,
	"allowRepeatedFlavors" boolean DEFAULT false NOT NULL,
	"visualDivisions" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"name" varchar(200) NOT NULL,
	"channel" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"audienceType" varchar(80) DEFAULT 'custom' NOT NULL,
	"messageTitle" varchar(200),
	"messageBody" text NOT NULL,
	"estimatedRecipients" integer DEFAULT 0 NOT NULL,
	"scheduledAt" timestamp,
	"sentAt" timestamp,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer,
	"userId" integer,
	"channel" varchar(32) NOT NULL,
	"destination" varchar(320),
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"providerMessageId" varchar(120),
	"convertedOrderId" integer,
	"metadata" text,
	"sentAt" timestamp,
	"deliveredAt" timestamp,
	"openedAt" timestamp,
	"clickedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"event" varchar(32) NOT NULL,
	"channel" varchar(32) DEFAULT 'both' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"redirectUrl" varchar(500),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nps_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"orderId" integer NOT NULL,
	"userId" integer,
	"score" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_attributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"storeId" integer NOT NULL,
	"visitorId" varchar(96),
	"sessionId" varchar(96),
	"utmSource" varchar(160),
	"utmMedium" varchar(160),
	"utmCampaign" varchar(200),
	"utmContent" varchar(200),
	"utmTerm" varchar(200),
	"fbclid" varchar(255),
	"gclid" varchar(255),
	"ttclid" varchar(255),
	"referrer" text,
	"landingPage" text,
	"firstTouchSource" varchar(160),
	"firstTouchMedium" varchar(160),
	"firstTouchCampaign" varchar(200),
	"lastTouchSource" varchar(160),
	"lastTouchMedium" varchar(160),
	"lastTouchCampaign" varchar(200),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"orderId" integer NOT NULL,
	"orderItemId" integer NOT NULL,
	"groupName" varchar(120) NOT NULL,
	"optionName" varchar(160) NOT NULL,
	"optionId" integer,
	"linkedProductId" integer,
	"priceDelta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"totalPrice" numeric(10, 2) DEFAULT '0' NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"productId" integer NOT NULL,
	"productName" varchar(200) NOT NULL,
	"productPrice" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text,
	"snapshotVersion" integer DEFAULT 1 NOT NULL,
	"configurationSnapshot" text,
	"pricingBreakdown" text,
	"subtotal" numeric(10, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"userId" integer NOT NULL,
	"senderRole" varchar(32) NOT NULL,
	"message" varchar(1000) NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_stage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"previousStatus" varchar(32),
	"nextStatus" varchar(32) NOT NULL,
	"stage" varchar(32) NOT NULL,
	"source" varchar(32) DEFAULT 'system' NOT NULL,
	"changedByUserId" integer,
	"changedByDriverId" integer,
	"notes" varchar(255),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"userId" integer,
	"serviceType" varchar(32) DEFAULT 'delivery' NOT NULL,
	"customerName" varchar(200) NOT NULL,
	"customerEmail" varchar(320),
	"customerPhone" varchar(20),
	"deliveryAddress" text NOT NULL,
	"deliveryNeighborhood" varchar(120),
	"deliveryCity" varchar(100),
	"deliveryCep" varchar(10),
	"deliveryComplement" varchar(200),
	"subtotal" numeric(10, 2) NOT NULL,
	"discountAmount" numeric(10, 2) DEFAULT '0',
	"deliveryFee" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"couponCode" varchar(50),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"paymentMethod" varchar(32) NOT NULL,
	"paymentStatus" varchar(32) DEFAULT 'pending' NOT NULL,
	"stripePaymentIntentId" varchar(255),
	"stripeCheckoutSessionId" varchar(255),
	"asaasPaymentId" varchar(255),
	"pointsDiscount" numeric(10, 2) DEFAULT '0',
	"pointsUsed" integer DEFAULT 0,
	"notes" text,
	"driverId" integer,
	"tableSessionId" integer,
	"predictedReadyAt" timestamp,
	"predictedDeliveredAt" timestamp,
	"predictionLabel" varchar(120),
	"confirmedAt" timestamp,
	"preparingAt" timestamp,
	"readyAt" timestamp,
	"outForDeliveryAt" timestamp,
	"deliveredAt" timestamp,
	"cancelledAt" timestamp,
	"aiPaused" boolean DEFAULT false NOT NULL,
	"ifoodOrderId" varchar(100),
	"source" varchar(32) DEFAULT 'app',
	"nfceKey" varchar(100),
	"nfceStatus" varchar(32),
	"nfceUrl" text,
	"customerCpf" varchar(14),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"phone" varchar(20) NOT NULL,
	"purpose" varchar(32) DEFAULT 'login' NOT NULL,
	"codeHash" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"requestIp" varchar(64),
	"userAgent" text,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"actorUserId" integer,
	"action" varchar(80) NOT NULL,
	"fieldName" varchar(160),
	"previousValue" text,
	"newValue" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"weekday" integer,
	"startTime" varchar(5),
	"endTime" varchar(5),
	"startsAt" timestamp,
	"expiresAt" timestamp,
	"channel" varchar(32) DEFAULT 'all' NOT NULL,
	"unavailableBehavior" varchar(32) DEFAULT 'show_unavailable' NOT NULL,
	"stockLimit" integer,
	"pausedUntil" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_combos" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer,
	"createdByUserId" integer NOT NULL,
	"baseVersion" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'editing' NOT NULL,
	"draftData" text NOT NULL,
	"tutorialProgress" text,
	"lastSavedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_flavors" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"imageUrl" text,
	"ingredients" text,
	"removableIngredients" text,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"imageUrl" text NOT NULL,
	"altText" varchar(240),
	"kind" varchar(32) DEFAULT 'gallery' NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"ingredientId" integer NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"wastePercent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_option_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(32) DEFAULT 'multiple' NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"minSelections" integer DEFAULT 0 NOT NULL,
	"maxSelections" integer DEFAULT 1 NOT NULL,
	"freeSelections" integer DEFAULT 0 NOT NULL,
	"allowRepeatedOptions" boolean DEFAULT false NOT NULL,
	"appliesToAllSizes" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"groupId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"priceDelta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"linkedProductId" integer,
	"ingredientId" integer,
	"ingredientQuantity" numeric(10, 3),
	"imageUrl" text,
	"maxQuantity" integer DEFAULT 1 NOT NULL,
	"allowRepeat" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" text NOT NULL,
	"note" varchar(240),
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"internalCode" varchar(128),
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"promotionalPrice" numeric(10, 2),
	"promotionStartsAt" timestamp,
	"promotionEndsAt" timestamp,
	"serves" integer,
	"minFlavors" integer,
	"maxFlavors" integer,
	"maxAddons" integer,
	"preparationTime" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"productId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"sku" varchar(128),
	"price" numeric(10, 2) NOT NULL,
	"promotionalPrice" numeric(10, 2),
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productivity_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer,
	"storeId" integer,
	"eventType" varchar(32) NOT NULL,
	"actorType" varchar(32) DEFAULT 'system' NOT NULL,
	"actorUserId" integer,
	"actorDriverId" integer,
	"valueSeconds" integer NOT NULL,
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"imageUrl" text,
	"externalSource" varchar(32),
	"externalMerchantId" varchar(128),
	"externalId" varchar(128),
	"externalCode" varchar(128),
	"sku" varchar(128),
	"shortDescription" varchar(320),
	"productType" varchar(32) DEFAULT 'simple' NOT NULL,
	"pricingEngine" varchar(32) DEFAULT 'legacy_v1' NOT NULL,
	"editorialStatus" varchar(32) DEFAULT 'published' NOT NULL,
	"preparationTime" integer,
	"allergenNotice" text,
	"nutritionalInfo" text,
	"tags" text,
	"minQuantity" integer DEFAULT 1 NOT NULL,
	"maxQuantity" integer DEFAULT 99 NOT NULL,
	"couponEligible" boolean DEFAULT true NOT NULL,
	"pointsEligible" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"scheduledPublishAt" timestamp,
	"publishedAt" timestamp,
	"archivedAt" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"imageUrl" text,
	"externalSource" varchar(32),
	"externalMerchantId" varchar(128),
	"externalId" varchar(128),
	"couponCode" varchar(50),
	"active" boolean DEFAULT true NOT NULL,
	"requiresLogin" boolean DEFAULT true NOT NULL,
	"startsAt" timestamp,
	"endsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"raffleId" integer NOT NULL,
	"userId" integer NOT NULL,
	"userName" varchar(200),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffles" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"prize" varchar(300) NOT NULL,
	"imageUrl" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"winnerId" integer,
	"winnerName" varchar(200),
	"drawDate" timestamp,
	"endsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"referrerUserId" integer NOT NULL,
	"referredUserId" integer,
	"code" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"convertedOrderId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"convertedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "reward_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"rewardType" varchar(32) NOT NULL,
	"pointsCost" integer DEFAULT 0 NOT NULL,
	"value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"productId" integer,
	"category" varchar(80),
	"icon" varchar(64),
	"imageUrl" text,
	"badgeText" varchar(64),
	"buttonText" varchar(64) DEFAULT 'Resgatar' NOT NULL,
	"stock" integer,
	"totalRedemptions" integer DEFAULT 0 NOT NULL,
	"maxRedemptionsPerUser" integer,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"startsAt" timestamp,
	"expiresAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_coupon_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"couponId" integer NOT NULL,
	"redemptionId" integer NOT NULL,
	"userId" integer NOT NULL,
	"orderId" integer NOT NULL,
	"usedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"rewardId" integer NOT NULL,
	"code" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'available' NOT NULL,
	"assignedUserId" integer,
	"redemptionId" integer,
	"reservedAt" timestamp,
	"redeemedAt" timestamp,
	"usedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"rewardId" integer NOT NULL,
	"userId" integer NOT NULL,
	"couponId" integer,
	"pointsSpent" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"idempotencyKey" varchar(96) NOT NULL,
	"redeemedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"cancelledAt" timestamp,
	"cancellationReason" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"channel" varchar(32) DEFAULT 'push' NOT NULL,
	"targetAudience" varchar(32) DEFAULT 'all' NOT NULL,
	"scheduledAt" timestamp NOT NULL,
	"recurrence" varchar(32) DEFAULT 'once' NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"sentAt" timestamp,
	"sentCount" integer DEFAULT 0 NOT NULL,
	"neighborhoodFilter" text,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer,
	"userId" integer,
	"name" varchar(200) NOT NULL,
	"phone" varchar(20),
	"email" varchar(320),
	"role" varchar(32) NOT NULL,
	"accessToken" varchar(128),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"actorUserId" integer,
	"action" varchar(120) NOT NULL,
	"resourceType" varchar(80) NOT NULL,
	"resourceId" varchar(96),
	"requestId" varchar(96),
	"ipAddress" varchar(64),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_site_page_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pageId" integer NOT NULL,
	"versionNumber" integer NOT NULL,
	"content" text NOT NULL,
	"note" varchar(240),
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_site_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"pageKey" varchar(32) NOT NULL,
	"title" varchar(160) NOT NULL,
	"draftContent" text NOT NULL,
	"publishedVersionId" integer,
	"updatedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_tracking_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer NOT NULL,
	"metaPixelEnabled" boolean DEFAULT false NOT NULL,
	"metaPixelId" varchar(64),
	"googleAnalyticsEnabled" boolean DEFAULT false NOT NULL,
	"googleAnalyticsId" varchar(64),
	"googleAdsEnabled" boolean DEFAULT false NOT NULL,
	"googleAdsId" varchar(64),
	"tiktokPixelEnabled" boolean DEFAULT false NOT NULL,
	"tiktokPixelId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"displayName" varchar(200),
	"slug" varchar(100) NOT NULL,
	"document" varchar(32),
	"email" varchar(320),
	"city" varchar(100) NOT NULL,
	"address" text,
	"phone" varchar(20),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"serviceRadiusKm" numeric(6, 2) DEFAULT '25.00',
	"active" boolean DEFAULT true NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"cnpj" varchar(18),
	"inscricaoEstadual" varchar(30),
	"regimeTributario" integer DEFAULT 1,
	"csc" varchar(100),
	"cscId" varchar(10),
	"focusNfeToken" varchar(200),
	"nfceEnabled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "table_order_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"tableSessionId" integer NOT NULL,
	"orderId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_session_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tableSessionId" integer NOT NULL,
	"productId" integer NOT NULL,
	"productName" varchar(200) NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"addedByStaffId" integer,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"readyAt" timestamp,
	"servedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tableId" integer NOT NULL,
	"storeId" integer,
	"waiterStaffId" integer,
	"customerName" varchar(200),
	"guestCount" integer DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"notes" text,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discountAmount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tipAmount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"closedByStaffId" integer,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"stripePaymentIntentId" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'brl' NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"paymentMethod" varchar(50),
	"metadata" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upsells" (
	"id" serial PRIMARY KEY NOT NULL,
	"storeId" integer DEFAULT 0 NOT NULL,
	"suggestedProductId" integer NOT NULL,
	"triggerProductId" integer,
	"triggerMinTotal" numeric(10, 2),
	"type" varchar(32) DEFAULT 'upsell' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"discountPercent" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"triggerType" varchar(32) DEFAULT 'checkout' NOT NULL,
	"triggerSizeId" integer,
	"triggerModifierId" integer,
	"triggerCategoryId" integer,
	"displayType" varchar(32) DEFAULT 'checkout' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"startsAt" timestamp,
	"expiresAt" timestamp,
	"weekdays" varchar(32),
	"startTime" varchar(5),
	"endTime" varchar(5),
	"maxDisplaysPerCart" integer DEFAULT 1 NOT NULL,
	"dismissible" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"label" varchar(50) NOT NULL,
	"address" text NOT NULL,
	"cep" varchar(10),
	"city" varchar(100),
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"version" varchar(32) NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"ipAddress" varchar(64),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_store_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"storeId" integer NOT NULL,
	"role" varchar(32) DEFAULT 'viewer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"firstName" varchar(160),
	"lastName" varchar(160),
	"email" varchar(320),
	"username" varchar(191),
	"loginMethod" varchar(64),
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"phone" varchar(20),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"savedAddress" text,
	"savedCep" varchar(10),
	"savedCity" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"passwordHash" text,
	"resetToken" varchar(128),
	"resetTokenExpiresAt" timestamp,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"profileCompleted" boolean DEFAULT false NOT NULL,
	"avatarUrl" text,
	"loyaltyPoints" integer DEFAULT 0 NOT NULL,
	"clubPlan" varchar(32),
	"clubStatus" varchar(32),
	"clubStartDate" timestamp,
	"clubNextBillingDate" timestamp,
	"clubFreePizzaUsed" boolean DEFAULT false NOT NULL,
	"clubFreePizzaResetAt" timestamp,
	"stripeCustomerId" varchar(255),
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"eventId" varchar(255) NOT NULL,
	"eventType" varchar(120),
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "abandoned_carts_store_idx" ON "abandoned_carts" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "abandoned_carts_user_idx" ON "abandoned_carts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "abandoned_carts_status_expires_idx" ON "abandoned_carts" USING btree ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "auth_event_logs_user_created_idx" ON "auth_event_logs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "auth_event_logs_event_created_idx" ON "auth_event_logs" USING btree ("event","createdAt");--> statement-breakpoint
CREATE INDEX "automation_events_store_idx" ON "automation_events" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "automation_events_user_idx" ON "automation_events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "automation_events_type_step_idx" ON "automation_events" USING btree ("type","step");--> statement-breakpoint
CREATE INDEX "automation_events_created_idx" ON "automation_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "campaign_segments_campaign_idx" ON "campaign_segments" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "campaign_segments_filter_idx" ON "campaign_segments" USING btree ("filterKey");--> statement-breakpoint
CREATE INDEX "carousel_images_store_idx" ON "carousel_images" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "categories_store_idx" ON "categories" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_store_slug_unique" ON "categories" USING btree ("storeId","slug");--> statement-breakpoint
CREATE INDEX "categories_active_order_idx" ON "categories" USING btree ("active","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_external_uq" ON "categories" USING btree ("storeId","externalSource","externalMerchantId","externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "client_alert_reads_alert_user_idx" ON "client_alert_reads" USING btree ("alertId","userId");--> statement-breakpoint
CREATE INDEX "client_alert_reads_user_idx" ON "client_alert_reads" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "client_alerts_type_idx" ON "client_alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "client_alerts_active_idx" ON "client_alerts" USING btree ("active");--> statement-breakpoint
CREATE INDEX "client_alerts_created_idx" ON "client_alerts" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "client_notifications_store_user_idx" ON "client_notifications" USING btree ("storeId","userId");--> statement-breakpoint
CREATE INDEX "client_notifications_user_idx" ON "client_notifications" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "client_notifications_user_read_idx" ON "client_notifications" USING btree ("userId","read");--> statement-breakpoint
CREATE INDEX "client_notifications_created_at_idx" ON "client_notifications" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "club_payments_store_idx" ON "club_payments" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "club_payments_user_idx" ON "club_payments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "club_payments_status_idx" ON "club_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "combo_group_items_group_idx" ON "combo_group_items" USING btree ("storeId","groupId");--> statement-breakpoint
CREATE INDEX "combo_groups_combo_idx" ON "combo_groups" USING btree ("storeId","comboId");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_order_uq" ON "coupon_redemptions" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("couponId");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_user_idx" ON "coupon_redemptions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "coupons_store_idx" ON "coupons" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_store_code_unique" ON "coupons" USING btree ("storeId","code");--> statement-breakpoint
CREATE INDEX "coupons_user_idx" ON "coupons" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_external_uq" ON "coupons" USING btree ("storeId","externalSource","externalMerchantId","externalId");--> statement-breakpoint
CREATE INDEX "custom_customer_tags_store_idx" ON "custom_customer_tags" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "custom_customer_tags_user_idx" ON "custom_customer_tags" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "custom_customer_tags_tag_idx" ON "custom_customer_tags" USING btree ("tagId");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_customer_tags_unique" ON "custom_customer_tags" USING btree ("storeId","userId","tagId");--> statement-breakpoint
CREATE INDEX "custom_tags_store_idx" ON "custom_tags" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_tags_store_name_unique" ON "custom_tags" USING btree ("storeId","name");--> statement-breakpoint
CREATE INDEX "customer_auth_providers_user_idx" ON "customer_auth_providers" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_providers_provider_user_unique" ON "customer_auth_providers" USING btree ("provider","providerUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_providers_user_provider_unique" ON "customer_auth_providers" USING btree ("userId","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_metrics_user_store_unique" ON "customer_metrics" USING btree ("userId","storeId");--> statement-breakpoint
CREATE INDEX "customer_metrics_orders_idx" ON "customer_metrics" USING btree ("totalOrders");--> statement-breakpoint
CREATE INDEX "customer_metrics_spent_idx" ON "customer_metrics" USING btree ("totalSpent");--> statement-breakpoint
CREATE INDEX "customer_store_accounts_store_user_idx" ON "customer_store_accounts" USING btree ("storeId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_store_accounts_unique" ON "customer_store_accounts" USING btree ("storeId","userId");--> statement-breakpoint
CREATE INDEX "customer_tags_store_idx" ON "customer_tags" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "customer_tags_user_idx" ON "customer_tags" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "customer_tags_tag_idx" ON "customer_tags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tags_unique" ON "customer_tags" USING btree ("storeId","userId","tag");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_predictions_order_unique" ON "delivery_predictions" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "delivery_predictions_kind_idx" ON "delivery_predictions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "delivery_ratings_driver_idx" ON "delivery_ratings" USING btree ("driverId");--> statement-breakpoint
CREATE INDEX "delivery_ratings_user_idx" ON "delivery_ratings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "delivery_zones_store_idx" ON "delivery_zones" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "delivery_zones_store_neighborhood_idx" ON "delivery_zones" USING btree ("storeId","neighborhood");--> statement-breakpoint
CREATE INDEX "dining_tables_store_idx" ON "dining_tables" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "dining_tables_status_idx" ON "dining_tables" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "dining_tables_store_name_unique" ON "dining_tables" USING btree ("storeId","name");--> statement-breakpoint
CREATE INDEX "driver_locations_driver_idx" ON "driver_locations" USING btree ("driverId");--> statement-breakpoint
CREATE INDEX "driver_locations_order_idx" ON "driver_locations" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "driver_locations_driver_updated_idx" ON "driver_locations" USING btree ("driverId","updatedAt");--> statement-breakpoint
CREATE INDEX "driver_push_subscriptions_driver_idx" ON "driver_push_subscriptions" USING btree ("driverId");--> statement-breakpoint
CREATE INDEX "drivers_store_idx" ON "drivers" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "external_orders_channel_external_uq" ON "external_orders" USING btree ("channel","external_order_id");--> statement-breakpoint
CREATE INDEX "external_orders_restaurant_idx" ON "external_orders" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "external_orders_status_idx" ON "external_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_orders_created_idx" ON "external_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_unique" ON "favorites" USING btree ("userId","productId");--> statement-breakpoint
CREATE UNIQUE INDEX "flavor_size_prices_uq" ON "flavor_size_prices" USING btree ("storeId","flavorId","productSizeId");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_settings_store_uq" ON "growth_settings" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "ifood_integrations_restaurant_uq" ON "ifood_integrations" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "ifood_integrations_status_idx" ON "ifood_integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ifood_logs_restaurant_idx" ON "ifood_logs" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "ifood_logs_created_idx" ON "ifood_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ingredients_store_idx" ON "ingredients" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "ingredients_active_idx" ON "ingredients" USING btree ("active");--> statement-breakpoint
CREATE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_provider_uq" ON "integration_connections" USING btree ("storeId","provider");--> statement-breakpoint
CREATE INDEX "integration_connections_health_idx" ON "integration_connections" USING btree ("storeId","status");--> statement-breakpoint
CREATE INDEX "intelligence_suggestions_store_kind_idx" ON "intelligence_suggestions" USING btree ("storeId","kind","status");--> statement-breakpoint
CREATE INDEX "inventory_movements_ingredient_idx" ON "inventory_movements" USING btree ("ingredientId");--> statement-breakpoint
CREATE INDEX "inventory_movements_order_idx" ON "inventory_movements" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "inventory_movements_type_idx" ON "inventory_movements" USING btree ("movementType");--> statement-breakpoint
CREATE INDEX "inventory_movements_created_idx" ON "inventory_movements" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "journey_executions_store_idx" ON "journey_executions" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "journey_executions_journey_idx" ON "journey_executions" USING btree ("journeyId");--> statement-breakpoint
CREATE INDEX "journey_executions_user_idx" ON "journey_executions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "journey_executions_status_next_idx" ON "journey_executions" USING btree ("status","nextStepAt");--> statement-breakpoint
CREATE INDEX "journeys_store_idx" ON "journeys" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "journeys_status_idx" ON "journeys" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "kitchen_tickets_order_uq" ON "kitchen_tickets" USING btree ("storeId","orderId");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_board_idx" ON "kitchen_tickets" USING btree ("storeId","status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_order_credits_order_uq" ON "loyalty_order_credits" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "loyalty_order_credits_user_idx" ON "loyalty_order_credits" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "loyalty_tx_user_idx" ON "loyalty_transactions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "loyalty_tx_order_idx" ON "loyalty_transactions" USING btree ("orderId");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_sessions_store_session_uq" ON "marketing_sessions" USING btree ("storeId","sessionId");--> statement-breakpoint
CREATE INDEX "marketing_sessions_store_created_idx" ON "marketing_sessions" USING btree ("storeId","createdAt");--> statement-breakpoint
CREATE INDEX "marketing_sessions_store_source_created_idx" ON "marketing_sessions" USING btree ("storeId","utmSource","createdAt");--> statement-breakpoint
CREATE INDEX "marketing_sessions_visitor_idx" ON "marketing_sessions" USING btree ("visitorId");--> statement-breakpoint
CREATE INDEX "menu_slides_store_idx" ON "menu_slides" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "modifier_size_rules_uq" ON "modifier_size_rules" USING btree ("storeId","modifierOptionId","productSizeId");--> statement-breakpoint
CREATE UNIQUE INDEX "multi_flavor_settings_product_uq" ON "multi_flavor_settings" USING btree ("storeId","productId");--> statement-breakpoint
CREATE INDEX "notification_campaigns_store_idx" ON "notification_campaigns" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "notification_campaigns_status_idx" ON "notification_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_logs_campaign_idx" ON "notification_logs" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "notification_logs_user_idx" ON "notification_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "notification_logs_status_idx" ON "notification_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_templates_store_idx" ON "notification_templates" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "notification_templates_store_event_channel_idx" ON "notification_templates" USING btree ("storeId","event","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "nps_responses_order_uq" ON "nps_responses" USING btree ("storeId","orderId");--> statement-breakpoint
CREATE UNIQUE INDEX "order_attributions_order_uq" ON "order_attributions" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_attributions_store_created_idx" ON "order_attributions" USING btree ("storeId","createdAt");--> statement-breakpoint
CREATE INDEX "order_attributions_store_source_created_idx" ON "order_attributions" USING btree ("storeId","utmSource","createdAt");--> statement-breakpoint
CREATE INDEX "order_attributions_session_idx" ON "order_attributions" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "order_item_selections_order_idx" ON "order_item_selections" USING btree ("storeId","orderId");--> statement-breakpoint
CREATE INDEX "order_item_selections_item_idx" ON "order_item_selections" USING btree ("orderItemId");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "order_messages_order_idx" ON "order_messages" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_messages_order_created_idx" ON "order_messages" USING btree ("orderId","createdAt");--> statement-breakpoint
CREATE INDEX "order_stage_logs_order_idx" ON "order_stage_logs" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_stage_logs_stage_idx" ON "order_stage_logs" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "order_stage_logs_created_idx" ON "order_stage_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "orders_store_idx" ON "orders" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_driver_idx" ON "orders" USING btree ("driverId");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "orders_user_status_idx" ON "orders" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_purpose_idx" ON "otp_codes" USING btree ("phone","purpose");--> statement-breakpoint
CREATE INDEX "otp_codes_expires_idx" ON "otp_codes" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "product_audit_logs_product_idx" ON "product_audit_logs" USING btree ("storeId","productId","createdAt");--> statement-breakpoint
CREATE INDEX "product_availability_product_idx" ON "product_availability" USING btree ("storeId","productId","active");--> statement-breakpoint
CREATE UNIQUE INDEX "product_combos_product_uq" ON "product_combos" USING btree ("storeId","productId");--> statement-breakpoint
CREATE INDEX "product_drafts_product_idx" ON "product_drafts" USING btree ("storeId","productId","status");--> statement-breakpoint
CREATE INDEX "product_drafts_user_idx" ON "product_drafts" USING btree ("createdByUserId","status");--> statement-breakpoint
CREATE INDEX "product_flavors_product_idx" ON "product_flavors" USING btree ("storeId","productId","active","sortOrder");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("storeId","productId","active","sortOrder");--> statement-breakpoint
CREATE INDEX "product_ingredients_product_idx" ON "product_ingredients" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "product_ingredients_ingredient_idx" ON "product_ingredients" USING btree ("ingredientId");--> statement-breakpoint
CREATE UNIQUE INDEX "product_ingredients_unique" ON "product_ingredients" USING btree ("productId","ingredientId");--> statement-breakpoint
CREATE INDEX "product_option_groups_product_idx" ON "product_option_groups" USING btree ("storeId","productId","active");--> statement-breakpoint
CREATE INDEX "product_options_group_idx" ON "product_options" USING btree ("storeId","groupId","active");--> statement-breakpoint
CREATE UNIQUE INDEX "product_revisions_uq" ON "product_revisions" USING btree ("storeId","productId","version");--> statement-breakpoint
CREATE INDEX "product_revisions_product_idx" ON "product_revisions" USING btree ("productId","createdAt");--> statement-breakpoint
CREATE INDEX "product_sizes_product_idx" ON "product_sizes" USING btree ("storeId","productId","active","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "product_sizes_code_uq" ON "product_sizes" USING btree ("storeId","productId","internalCode");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("storeId","productId","active");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_store_sku_uq" ON "product_variants" USING btree ("storeId","sku");--> statement-breakpoint
CREATE INDEX "productivity_events_order_idx" ON "productivity_events" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "productivity_events_type_idx" ON "productivity_events" USING btree ("eventType");--> statement-breakpoint
CREATE INDEX "productivity_events_store_idx" ON "productivity_events" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "productivity_events_created_idx" ON "productivity_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "products_store_idx" ON "products" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "products_active_idx" ON "products" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "products_external_uq" ON "products" USING btree ("storeId","externalSource","externalMerchantId","externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_sku_uq" ON "products" USING btree ("storeId","sku");--> statement-breakpoint
CREATE INDEX "products_editorial_idx" ON "products" USING btree ("storeId","editorialStatus","active");--> statement-breakpoint
CREATE INDEX "promotions_store_idx" ON "promotions" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_external_uq" ON "promotions" USING btree ("storeId","externalSource","externalMerchantId","externalId");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "raffle_entries_raffle_idx" ON "raffle_entries" USING btree ("raffleId");--> statement-breakpoint
CREATE INDEX "raffle_entries_user_idx" ON "raffle_entries" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_entries_unique" ON "raffle_entries" USING btree ("raffleId","userId");--> statement-breakpoint
CREATE INDEX "raffles_store_idx" ON "raffles" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_store_code_uq" ON "referrals" USING btree ("storeId","code");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("storeId","referrerUserId");--> statement-breakpoint
CREATE INDEX "reward_catalog_store_idx" ON "reward_catalog" USING btree ("storeId","active");--> statement-breakpoint
CREATE INDEX "reward_catalog_display_idx" ON "reward_catalog" USING btree ("storeId","archivedAt","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_coupon_usages_coupon_uq" ON "reward_coupon_usages" USING btree ("couponId");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_coupon_usages_order_uq" ON "reward_coupon_usages" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "reward_coupon_usages_user_idx" ON "reward_coupon_usages" USING btree ("userId","usedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_coupons_store_code_uq" ON "reward_coupons" USING btree ("storeId","code");--> statement-breakpoint
CREATE INDEX "reward_coupons_reward_status_idx" ON "reward_coupons" USING btree ("rewardId","status");--> statement-breakpoint
CREATE INDEX "reward_coupons_user_idx" ON "reward_coupons" USING btree ("assignedUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_coupons_redemption_uq" ON "reward_coupons" USING btree ("redemptionId");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_redemptions_idempotency_uq" ON "reward_redemptions" USING btree ("storeId","userId","idempotencyKey");--> statement-breakpoint
CREATE INDEX "reward_redemptions_reward_idx" ON "reward_redemptions" USING btree ("rewardId","status");--> statement-breakpoint
CREATE INDEX "reward_redemptions_user_idx" ON "reward_redemptions" USING btree ("userId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_redemptions_coupon_uq" ON "reward_redemptions" USING btree ("couponId");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_store_idx" ON "scheduled_notifications" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_store_scheduled_status_idx" ON "scheduled_notifications" USING btree ("storeId","scheduledAt","status");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_scheduled_status_idx" ON "scheduled_notifications" USING btree ("scheduledAt","status");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_status_idx" ON "scheduled_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_members_store_idx" ON "staff_members" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "staff_members_role_idx" ON "staff_members" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_user_unique" ON "staff_members" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_access_token_unique" ON "staff_members" USING btree ("accessToken");--> statement-breakpoint
CREATE INDEX "store_audit_logs_store_created_idx" ON "store_audit_logs" USING btree ("storeId","createdAt");--> statement-breakpoint
CREATE INDEX "store_audit_logs_actor_idx" ON "store_audit_logs" USING btree ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX "store_audit_logs_action_idx" ON "store_audit_logs" USING btree ("action","createdAt");--> statement-breakpoint
CREATE INDEX "store_settings_store_idx" ON "store_settings" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "store_settings_store_key_unique" ON "store_settings" USING btree ("storeId","key");--> statement-breakpoint
CREATE UNIQUE INDEX "store_site_page_versions_uq" ON "store_site_page_versions" USING btree ("pageId","versionNumber");--> statement-breakpoint
CREATE INDEX "store_site_page_versions_page_idx" ON "store_site_page_versions" USING btree ("pageId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "store_site_pages_store_page_uq" ON "store_site_pages" USING btree ("storeId","pageKey");--> statement-breakpoint
CREATE INDEX "store_site_pages_store_idx" ON "store_site_pages" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "store_tracking_settings_store_uq" ON "store_tracking_settings" USING btree ("storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_slug_idx" ON "stores" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "stores_active_idx" ON "stores" USING btree ("active");--> statement-breakpoint
CREATE INDEX "stores_status_idx" ON "stores" USING btree ("status");--> statement-breakpoint
CREATE INDEX "table_order_links_session_idx" ON "table_order_links" USING btree ("tableSessionId");--> statement-breakpoint
CREATE UNIQUE INDEX "table_order_links_order_unique" ON "table_order_links" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "table_session_items_session_idx" ON "table_session_items" USING btree ("tableSessionId");--> statement-breakpoint
CREATE INDEX "table_session_items_product_idx" ON "table_session_items" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "table_session_items_requested_at_idx" ON "table_session_items" USING btree ("requestedAt");--> statement-breakpoint
CREATE INDEX "table_session_items_status_idx" ON "table_session_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "table_sessions_table_idx" ON "table_sessions" USING btree ("tableId");--> statement-breakpoint
CREATE INDEX "table_sessions_waiter_idx" ON "table_sessions" USING btree ("waiterStaffId");--> statement-breakpoint
CREATE INDEX "table_sessions_status_idx" ON "table_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "table_sessions_closed_by_idx" ON "table_sessions" USING btree ("closedByStaffId");--> statement-breakpoint
CREATE INDEX "transactions_order_idx" ON "transactions" USING btree ("orderId");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_order_intent_uq" ON "transactions" USING btree ("orderId","stripePaymentIntentId");--> statement-breakpoint
CREATE INDEX "upsells_store_idx" ON "upsells" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "user_addresses_user_idx" ON "user_addresses" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_consents_user_kind_created_idx" ON "user_consents" USING btree ("userId","kind","createdAt");--> statement-breakpoint
CREATE INDEX "user_store_access_user_idx" ON "user_store_access" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_store_access_store_idx" ON "user_store_access" USING btree ("storeId");--> statement-breakpoint
CREATE INDEX "user_store_access_store_role_idx" ON "user_store_access" USING btree ("storeId","role");--> statement-breakpoint
CREATE UNIQUE INDEX "user_store_access_unique" ON "user_store_access" USING btree ("userId","storeId");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_reset_token_idx" ON "users" USING btree ("resetToken");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uq" ON "webhook_events" USING btree ("provider","eventId");