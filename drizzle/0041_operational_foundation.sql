ALTER TABLE `orders`
  ADD COLUMN `serviceType` enum('delivery','pickup','dine_in','counter') NOT NULL DEFAULT 'delivery',
  ADD COLUMN `deliveryNeighborhood` varchar(120),
  ADD COLUMN `tableSessionId` int,
  ADD COLUMN `predictedReadyAt` timestamp NULL,
  ADD COLUMN `predictedDeliveredAt` timestamp NULL,
  ADD COLUMN `predictionLabel` varchar(120),
  ADD COLUMN `confirmedAt` timestamp NULL,
  ADD COLUMN `preparingAt` timestamp NULL,
  ADD COLUMN `readyAt` timestamp NULL,
  ADD COLUMN `outForDeliveryAt` timestamp NULL,
  ADD COLUMN `deliveredAt` timestamp NULL,
  ADD COLUMN `cancelledAt` timestamp NULL;

CREATE TABLE `ingredients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int,
  `name` varchar(160) NOT NULL,
  `category` varchar(120),
  `unit` enum('g','kg','ml','l','unit','pack','slice','portion') NOT NULL,
  `currentStock` decimal(12,3) NOT NULL DEFAULT '0.000',
  `minimumStock` decimal(12,3) NOT NULL DEFAULT '0.000',
  `unitCost` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `supplier` varchar(160),
  `notes` text,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ingredients_id` PRIMARY KEY(`id`)
);
CREATE INDEX `ingredients_store_idx` ON `ingredients` (`storeId`);
CREATE INDEX `ingredients_active_idx` ON `ingredients` (`active`);
CREATE INDEX `ingredients_name_idx` ON `ingredients` (`name`);

CREATE TABLE `product_ingredients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `productId` int NOT NULL,
  `ingredientId` int NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `wastePercent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `product_ingredients_id` PRIMARY KEY(`id`)
);
CREATE INDEX `product_ingredients_product_idx` ON `product_ingredients` (`productId`);
CREATE INDEX `product_ingredients_ingredient_idx` ON `product_ingredients` (`ingredientId`);
CREATE UNIQUE INDEX `product_ingredients_unique` ON `product_ingredients` (`productId`,`ingredientId`);

CREATE TABLE `inventory_movements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ingredientId` int NOT NULL,
  `storeId` int,
  `orderId` int,
  `orderItemId` int,
  `movementType` enum('entry','manual_adjustment','sale_consumption','reversal','waste') NOT NULL,
  `quantityDelta` decimal(12,3) NOT NULL,
  `previousStock` decimal(12,3) NOT NULL DEFAULT '0.000',
  `nextStock` decimal(12,3) NOT NULL DEFAULT '0.000',
  `reason` varchar(255),
  `performedByUserId` int,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
CREATE INDEX `inventory_movements_ingredient_idx` ON `inventory_movements` (`ingredientId`);
CREATE INDEX `inventory_movements_order_idx` ON `inventory_movements` (`orderId`);
CREATE INDEX `inventory_movements_type_idx` ON `inventory_movements` (`movementType`);
CREATE INDEX `inventory_movements_created_idx` ON `inventory_movements` (`createdAt`);

CREATE TABLE `order_stage_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `previousStatus` enum('pending','confirmed','preparing','out_for_delivery','delivered','cancelled'),
  `nextStatus` enum('pending','confirmed','preparing','out_for_delivery','delivered','cancelled') NOT NULL,
  `stage` enum('created','confirmed','preparing','ready','out_for_delivery','delivered','cancelled') NOT NULL,
  `source` enum('system','admin','manager','driver','automation','customer') NOT NULL DEFAULT 'system',
  `changedByUserId` int,
  `changedByDriverId` int,
  `notes` varchar(255),
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `order_stage_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `order_stage_logs_order_idx` ON `order_stage_logs` (`orderId`);
CREATE INDEX `order_stage_logs_stage_idx` ON `order_stage_logs` (`stage`);
CREATE INDEX `order_stage_logs_created_idx` ON `order_stage_logs` (`createdAt`);

CREATE TABLE `productivity_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int,
  `storeId` int,
  `eventType` enum('acceptance_time','prep_time','dispatch_time','delivery_time','total_time','delay') NOT NULL,
  `actorType` enum('system','user','staff','driver') NOT NULL DEFAULT 'system',
  `actorUserId` int,
  `actorDriverId` int,
  `valueSeconds` int NOT NULL,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `productivity_events_id` PRIMARY KEY(`id`)
);
CREATE INDEX `productivity_events_order_idx` ON `productivity_events` (`orderId`);
CREATE INDEX `productivity_events_type_idx` ON `productivity_events` (`eventType`);
CREATE INDEX `productivity_events_store_idx` ON `productivity_events` (`storeId`);
CREATE INDEX `productivity_events_created_idx` ON `productivity_events` (`createdAt`);

CREATE TABLE `staff_members` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int,
  `userId` int,
  `name` varchar(200) NOT NULL,
  `phone` varchar(20),
  `email` varchar(320),
  `role` enum('waiter','cashier','attendant','kitchen','driver','manager','admin') NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `staff_members_id` PRIMARY KEY(`id`)
);
CREATE INDEX `staff_members_store_idx` ON `staff_members` (`storeId`);
CREATE INDEX `staff_members_role_idx` ON `staff_members` (`role`);
CREATE UNIQUE INDEX `staff_members_user_unique` ON `staff_members` (`userId`);

CREATE TABLE `delivery_predictions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `kind` enum('delivery','pickup','dine_in') NOT NULL DEFAULT 'delivery',
  `predictionLabel` varchar(120) NOT NULL,
  `minMinutes` int NOT NULL,
  `maxMinutes` int NOT NULL,
  `prepBaseMinutes` int NOT NULL DEFAULT 0,
  `deliveryBaseMinutes` int NOT NULL DEFAULT 0,
  `queuePressure` int NOT NULL DEFAULT 0,
  `neighborhood` varchar(120),
  `method` varchar(80) NOT NULL DEFAULT 'heuristic',
  `computedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `delivery_predictions_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `delivery_predictions_order_unique` ON `delivery_predictions` (`orderId`);
CREATE INDEX `delivery_predictions_kind_idx` ON `delivery_predictions` (`kind`);

CREATE TABLE `dining_tables` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int,
  `name` varchar(80) NOT NULL,
  `status` enum('free','occupied','reserved','awaiting_closure') NOT NULL DEFAULT 'free',
  `capacity` int NOT NULL DEFAULT 4,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `dining_tables_id` PRIMARY KEY(`id`)
);
CREATE INDEX `dining_tables_store_idx` ON `dining_tables` (`storeId`);
CREATE INDEX `dining_tables_status_idx` ON `dining_tables` (`status`);
CREATE UNIQUE INDEX `dining_tables_store_name_unique` ON `dining_tables` (`storeId`,`name`);

CREATE TABLE `table_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tableId` int NOT NULL,
  `storeId` int,
  `waiterStaffId` int,
  `customerName` varchar(200),
  `guestCount` int NOT NULL DEFAULT 1,
  `status` enum('open','awaiting_closure','closed','cancelled') NOT NULL DEFAULT 'open',
  `notes` text,
  `openedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closedAt` timestamp NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discountAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `table_sessions_id` PRIMARY KEY(`id`)
);
CREATE INDEX `table_sessions_table_idx` ON `table_sessions` (`tableId`);
CREATE INDEX `table_sessions_waiter_idx` ON `table_sessions` (`waiterStaffId`);
CREATE INDEX `table_sessions_status_idx` ON `table_sessions` (`status`);

CREATE TABLE `table_order_links` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tableSessionId` int NOT NULL,
  `orderId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `table_order_links_id` PRIMARY KEY(`id`)
);
CREATE INDEX `table_order_links_session_idx` ON `table_order_links` (`tableSessionId`);
CREATE UNIQUE INDEX `table_order_links_order_unique` ON `table_order_links` (`orderId`);

CREATE TABLE `notification_campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int,
  `name` varchar(200) NOT NULL,
  `channel` enum('push','whatsapp','sms','email') NOT NULL,
  `status` enum('draft','scheduled','sending','sent','error') NOT NULL DEFAULT 'draft',
  `audienceType` varchar(80) NOT NULL DEFAULT 'custom',
  `messageTitle` varchar(200),
  `messageBody` text NOT NULL,
  `estimatedRecipients` int NOT NULL DEFAULT 0,
  `scheduledAt` timestamp NULL,
  `sentAt` timestamp NULL,
  `createdByUserId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `notification_campaigns_id` PRIMARY KEY(`id`)
);
CREATE INDEX `notification_campaigns_store_idx` ON `notification_campaigns` (`storeId`);
CREATE INDEX `notification_campaigns_status_idx` ON `notification_campaigns` (`status`);

CREATE TABLE `campaign_segments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `campaignId` int NOT NULL,
  `filterKey` varchar(80) NOT NULL,
  `operator` varchar(20) NOT NULL DEFAULT 'eq',
  `value` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `campaign_segments_id` PRIMARY KEY(`id`)
);
CREATE INDEX `campaign_segments_campaign_idx` ON `campaign_segments` (`campaignId`);
CREATE INDEX `campaign_segments_filter_idx` ON `campaign_segments` (`filterKey`);

CREATE TABLE `notification_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `campaignId` int,
  `userId` int,
  `channel` enum('push','whatsapp','sms','email') NOT NULL,
  `destination` varchar(320),
  `status` enum('queued','sent','delivered','opened','clicked','converted','failed') NOT NULL DEFAULT 'queued',
  `providerMessageId` varchar(120),
  `convertedOrderId` int,
  `metadata` text,
  `sentAt` timestamp NULL,
  `deliveredAt` timestamp NULL,
  `openedAt` timestamp NULL,
  `clickedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `notification_logs_campaign_idx` ON `notification_logs` (`campaignId`);
CREATE INDEX `notification_logs_user_idx` ON `notification_logs` (`userId`);
CREATE INDEX `notification_logs_status_idx` ON `notification_logs` (`status`);

CREATE TABLE `customer_metrics` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `storeId` int NOT NULL DEFAULT 0,
  `firstOrderAt` timestamp NULL,
  `lastOrderAt` timestamp NULL,
  `totalOrders` int NOT NULL DEFAULT 0,
  `deliveredOrders` int NOT NULL DEFAULT 0,
  `cancelledOrders` int NOT NULL DEFAULT 0,
  `firstOrderCount` int NOT NULL DEFAULT 0,
  `totalSpent` decimal(12,2) NOT NULL DEFAULT '0.00',
  `averageTicket` decimal(12,2) NOT NULL DEFAULT '0.00',
  `favoriteNeighborhood` varchar(120),
  `favoriteOrderDay` varchar(20),
  `favoriteOrderHour` int,
  `favoriteProductName` varchar(200),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `customer_metrics_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `customer_metrics_user_store_unique` ON `customer_metrics` (`userId`,`storeId`);
CREATE INDEX `customer_metrics_orders_idx` ON `customer_metrics` (`totalOrders`);
CREATE INDEX `customer_metrics_spent_idx` ON `customer_metrics` (`totalSpent`);

CREATE TABLE `customer_auth_providers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `provider` enum('email','phone','google','apple','facebook','instagram','manus') NOT NULL,
  `providerUserId` varchar(191) NOT NULL,
  `providerEmail` varchar(320),
  `providerPhone` varchar(20),
  `isPrimary` boolean NOT NULL DEFAULT false,
  `linkedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `customer_auth_providers_id` PRIMARY KEY(`id`)
);
CREATE INDEX `customer_auth_providers_user_idx` ON `customer_auth_providers` (`userId`);
CREATE UNIQUE INDEX `customer_auth_providers_provider_user_unique` ON `customer_auth_providers` (`provider`,`providerUserId`);
CREATE UNIQUE INDEX `customer_auth_providers_user_provider_unique` ON `customer_auth_providers` (`userId`,`provider`);

CREATE TABLE `otp_codes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int,
  `phone` varchar(20) NOT NULL,
  `purpose` enum('login','verify_phone') NOT NULL DEFAULT 'login',
  `codeHash` varchar(255) NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `requestIp` varchar(64),
  `userAgent` text,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
CREATE INDEX `otp_codes_phone_idx` ON `otp_codes` (`phone`);
CREATE INDEX `otp_codes_phone_purpose_idx` ON `otp_codes` (`phone`,`purpose`);
CREATE INDEX `otp_codes_expires_idx` ON `otp_codes` (`expiresAt`);
