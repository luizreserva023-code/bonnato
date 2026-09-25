ALTER TABLE `products`
  ADD COLUMN `sku` varchar(128) NULL AFTER `externalCode`,
  ADD COLUMN `shortDescription` varchar(320) NULL AFTER `sku`,
  ADD COLUMN `productType` enum('simple','sizes','variants','buildable','multi_flavor','combo','weight','quantity','variable_price') NOT NULL DEFAULT 'simple' AFTER `shortDescription`,
  ADD COLUMN `pricingEngine` enum('legacy_v1','configured_v2') NOT NULL DEFAULT 'legacy_v1' AFTER `productType`,
  ADD COLUMN `editorialStatus` enum('draft','published','scheduled','archived') NOT NULL DEFAULT 'published' AFTER `pricingEngine`,
  ADD COLUMN `preparationTime` int NULL AFTER `editorialStatus`,
  ADD COLUMN `allergenNotice` text NULL AFTER `preparationTime`,
  ADD COLUMN `nutritionalInfo` text NULL AFTER `allergenNotice`,
  ADD COLUMN `tags` text NULL AFTER `nutritionalInfo`,
  ADD COLUMN `minQuantity` int NOT NULL DEFAULT 1 AFTER `tags`,
  ADD COLUMN `maxQuantity` int NOT NULL DEFAULT 99 AFTER `minQuantity`,
  ADD COLUMN `couponEligible` boolean NOT NULL DEFAULT true AFTER `maxQuantity`,
  ADD COLUMN `pointsEligible` boolean NOT NULL DEFAULT true AFTER `couponEligible`,
  ADD COLUMN `version` int NOT NULL DEFAULT 1 AFTER `pointsEligible`,
  ADD COLUMN `scheduledPublishAt` timestamp NULL AFTER `version`,
  ADD COLUMN `publishedAt` timestamp NULL AFTER `scheduledPublishAt`,
  ADD COLUMN `archivedAt` timestamp NULL AFTER `publishedAt`,
  ADD UNIQUE KEY `products_store_sku_uq` (`storeId`, `sku`),
  ADD KEY `products_editorial_idx` (`storeId`, `editorialStatus`, `active`),
  ADD CONSTRAINT `products_quantity_range_chk` CHECK (`minQuantity` >= 1 AND `maxQuantity` >= `minQuantity`),
  ADD CONSTRAINT `products_version_positive_chk` CHECK (`version` >= 1);

ALTER TABLE `product_option_groups`
  ADD COLUMN `description` text NULL AFTER `kind`,
  ADD COLUMN `freeSelections` int NOT NULL DEFAULT 0 AFTER `maxSelections`,
  ADD COLUMN `allowRepeatedOptions` boolean NOT NULL DEFAULT false AFTER `freeSelections`,
  ADD COLUMN `appliesToAllSizes` boolean NOT NULL DEFAULT true AFTER `allowRepeatedOptions`,
  ADD CONSTRAINT `product_option_groups_limits_chk` CHECK (`minSelections` >= 0 AND `maxSelections` >= `minSelections` AND `freeSelections` >= 0);

ALTER TABLE `product_options`
  ADD COLUMN `maxQuantity` int NOT NULL DEFAULT 1 AFTER `imageUrl`,
  ADD COLUMN `allowRepeat` boolean NOT NULL DEFAULT false AFTER `maxQuantity`,
  ADD CONSTRAINT `product_options_quantity_chk` CHECK (`maxQuantity` >= 1),
  ADD CONSTRAINT `product_options_price_chk` CHECK (`priceDelta` >= 0);

ALTER TABLE `combo_groups`
  ADD COLUMN `required` boolean NOT NULL DEFAULT true AFTER `name`,
  ADD COLUMN `active` boolean NOT NULL DEFAULT true AFTER `sortOrder`,
  ADD CONSTRAINT `combo_groups_limits_chk` CHECK (`minSelections` >= 0 AND `maxSelections` >= `minSelections`);

ALTER TABLE `combo_group_items`
  ADD COLUMN `sizeId` int NULL AFTER `productId`,
  ADD CONSTRAINT `combo_group_items_price_chk` CHECK (`priceDelta` >= 0);

ALTER TABLE `upsells`
  ADD COLUMN `triggerType` enum('product_selected','size_selected','modifier_selected','category_selected','cart_value','missing_category','checkout') NOT NULL DEFAULT 'checkout' AFTER `sortOrder`,
  ADD COLUMN `triggerSizeId` int NULL AFTER `triggerType`,
  ADD COLUMN `triggerModifierId` int NULL AFTER `triggerSizeId`,
  ADD COLUMN `triggerCategoryId` int NULL AFTER `triggerModifierId`,
  ADD COLUMN `displayType` enum('inline','modal','cart','checkout') NOT NULL DEFAULT 'checkout' AFTER `triggerCategoryId`,
  ADD COLUMN `priority` int NOT NULL DEFAULT 0 AFTER `displayType`,
  ADD COLUMN `startsAt` timestamp NULL AFTER `priority`,
  ADD COLUMN `expiresAt` timestamp NULL AFTER `startsAt`,
  ADD COLUMN `weekdays` varchar(32) NULL AFTER `expiresAt`,
  ADD COLUMN `startTime` varchar(5) NULL AFTER `weekdays`,
  ADD COLUMN `endTime` varchar(5) NULL AFTER `startTime`,
  ADD COLUMN `maxDisplaysPerCart` int NOT NULL DEFAULT 1 AFTER `endTime`,
  ADD COLUMN `dismissible` boolean NOT NULL DEFAULT true AFTER `maxDisplaysPerCart`;

ALTER TABLE `order_items`
  ADD COLUMN `snapshotVersion` int NOT NULL DEFAULT 1 AFTER `notes`,
  ADD COLUMN `configurationSnapshot` text NULL AFTER `snapshotVersion`,
  ADD COLUMN `pricingBreakdown` text NULL AFTER `configurationSnapshot`;

ALTER TABLE `order_item_selections`
  ADD COLUMN `totalPrice` decimal(10,2) NOT NULL DEFAULT 0 AFTER `quantity`;

CREATE TABLE `product_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `storeId` int NOT NULL,
  `productId` int NOT NULL,
  `imageUrl` text NOT NULL,
  `altText` varchar(240) NULL,
  `kind` enum('primary','gallery','flavor','nutrition') NOT NULL DEFAULT 'gallery',
  `sortOrder` int NOT NULL DEFAULT 0,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_images_product_idx` (`storeId`, `productId`, `active`, `sortOrder`)
);

CREATE TABLE `product_sizes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `storeId` int NOT NULL,
  `productId` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `internalCode` varchar(128) NULL,
  `description` text NULL,
  `price` decimal(10,2) NOT NULL,
  `promotionalPrice` decimal(10,2) NULL,
  `promotionStartsAt` timestamp NULL,
  `promotionEndsAt` timestamp NULL,
  `serves` int NULL,
  `minFlavors` int NULL,
  `maxFlavors` int NULL,
  `maxAddons` int NULL,
  `preparationTime` int NULL,
  `active` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_sizes_code_uq` (`storeId`, `productId`, `internalCode`),
  KEY `product_sizes_product_idx` (`storeId`, `productId`, `active`, `sortOrder`),
  CONSTRAINT `product_sizes_price_chk` CHECK (`price` >= 0 AND (`promotionalPrice` IS NULL OR `promotionalPrice` >= 0)),
  CONSTRAINT `product_sizes_flavor_limits_chk` CHECK (`minFlavors` IS NULL OR `maxFlavors` IS NULL OR (`minFlavors` >= 0 AND `maxFlavors` >= `minFlavors`))
);

CREATE TABLE `product_variants` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NOT NULL,
  `name` varchar(160) NOT NULL, `sku` varchar(128) NULL, `price` decimal(10,2) NOT NULL, `promotionalPrice` decimal(10,2) NULL,
  `active` boolean NOT NULL DEFAULT true, `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `product_variants_store_sku_uq` (`storeId`, `sku`), KEY `product_variants_product_idx` (`storeId`, `productId`, `active`)
);

CREATE TABLE `product_availability` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NOT NULL,
  `weekday` int NULL, `startTime` varchar(5) NULL, `endTime` varchar(5) NULL, `startsAt` timestamp NULL, `expiresAt` timestamp NULL,
  `channel` enum('all','delivery','pickup','dine_in','counter') NOT NULL DEFAULT 'all',
  `unavailableBehavior` enum('hide','show_unavailable','show_return_time') NOT NULL DEFAULT 'show_unavailable',
  `stockLimit` int NULL, `pausedUntil` timestamp NULL, `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `product_availability_product_idx` (`storeId`, `productId`, `active`),
  CONSTRAINT `product_availability_weekday_chk` CHECK (`weekday` IS NULL OR (`weekday` >= 0 AND `weekday` <= 6)),
  CONSTRAINT `product_availability_stock_chk` CHECK (`stockLimit` IS NULL OR `stockLimit` >= 0)
);

CREATE TABLE `modifier_size_rules` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `modifierOptionId` int NOT NULL, `productSizeId` int NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true, `priceOverride` decimal(10,2) NULL, `maxQuantityOverride` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `modifier_size_rules_uq` (`storeId`, `modifierOptionId`, `productSizeId`)
);

CREATE TABLE `multi_flavor_settings` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `pricingRule` enum('highest_price','average_price','proportional_price','size_fixed_price','base_plus_difference') NOT NULL DEFAULT 'highest_price',
  `allowRepeatedFlavors` boolean NOT NULL DEFAULT false, `visualDivisions` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `multi_flavor_settings_product_uq` (`storeId`, `productId`)
);

CREATE TABLE `product_flavors` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NOT NULL,
  `name` varchar(160) NOT NULL, `description` text NULL, `imageUrl` text NULL, `ingredients` text NULL, `removableIngredients` text NULL,
  `active` boolean NOT NULL DEFAULT true, `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `product_flavors_product_idx` (`storeId`, `productId`, `active`, `sortOrder`)
);

CREATE TABLE `flavor_size_prices` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `flavorId` int NOT NULL, `productSizeId` int NOT NULL,
  `price` decimal(10,2) NOT NULL, `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `flavor_size_prices_uq` (`storeId`, `flavorId`, `productSizeId`),
  CONSTRAINT `flavor_size_prices_price_chk` CHECK (`price` >= 0)
);

CREATE TABLE `product_drafts` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NULL, `createdByUserId` int NOT NULL,
  `baseVersion` int NOT NULL DEFAULT 0, `status` enum('editing','ready','published','discarded') NOT NULL DEFAULT 'editing',
  `draftData` text NOT NULL, `tutorialProgress` text NULL, `lastSavedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `product_drafts_product_idx` (`storeId`, `productId`, `status`), KEY `product_drafts_user_idx` (`createdByUserId`, `status`)
);

CREATE TABLE `product_revisions` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NOT NULL, `version` int NOT NULL,
  `snapshot` text NOT NULL, `note` varchar(240) NULL, `createdByUserId` int NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `product_revisions_uq` (`storeId`, `productId`, `version`), KEY `product_revisions_product_idx` (`productId`, `createdAt`)
);

CREATE TABLE `product_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT, `storeId` int NOT NULL, `productId` int NOT NULL, `actorUserId` int NULL,
  `action` varchar(80) NOT NULL, `fieldName` varchar(160) NULL, `previousValue` text NULL, `newValue` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `product_audit_logs_product_idx` (`storeId`, `productId`, `createdAt`)
);
