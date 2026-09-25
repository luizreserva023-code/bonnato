CREATE TABLE IF NOT EXISTS `store_white_label_configs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int NOT NULL,
  `status` enum('active','inactive','setup_pending') NOT NULL DEFAULT 'setup_pending',
  `plan` enum('essential','pro','enterprise','custom') NOT NULL DEFAULT 'essential',
  `domain` varchar(191),
  `subdomain` varchar(100),
  `brandName` varchar(200) NOT NULL,
  `shortName` varchar(100) NOT NULL,
  `tagline` varchar(240),
  `adminTitle` varchar(200),
  `deliveryLabel` varchar(200),
  `logoUrl` text,
  `wordmarkUrl` text,
  `faviconUrl` text,
  `waiterLogoUrl` text,
  `primaryColor` varchar(20) NOT NULL DEFAULT '#6E0D12',
  `primaryDarkColor` varchar(20) NOT NULL DEFAULT '#450709',
  `accentColor` varchar(20) NOT NULL DEFAULT '#e05c5c',
  `backgroundColor` varchar(20) NOT NULL DEFAULT '#fffaf8',
  `textColor` varchar(20) NOT NULL DEFAULT '#211719',
  `featureFlags` text NOT NULL,
  `providerConfig` text NOT NULL,
  `pageConfig` text NOT NULL,
  `contactConfig` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `store_white_label_store_unique` (`storeId`),
  UNIQUE KEY `store_white_label_domain_unique` (`domain`),
  UNIQUE KEY `store_white_label_subdomain_unique` (`subdomain`),
  KEY `store_white_label_status_idx` (`status`)
);

ALTER TABLE `stores` ADD COLUMN IF NOT EXISTS `tenantKey` varchar(100) NULL AFTER `id`;
UPDATE `stores`
SET `tenantKey` = CASE
  WHEN `isDefault` = 1 OR LOWER(`name`) LIKE '%bonatto%' OR LOWER(`name`) LIKE '%bonnato%' THEN 'bonatto'
  ELSE `slug`
END
WHERE `tenantKey` IS NULL OR `tenantKey` = '';
ALTER TABLE `stores` MODIFY `tenantKey` varchar(100) NOT NULL DEFAULT 'bonatto';
CREATE INDEX `stores_tenant_idx` ON `stores` (`tenantKey`);

ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
UPDATE `categories`
SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0)
WHERE `storeId` IS NULL;
ALTER TABLE `categories` MODIFY `storeId` int NOT NULL DEFAULT 0;
DROP INDEX `categories_slug_unique` ON `categories`;
DROP INDEX `categories_external_uq` ON `categories`;
CREATE INDEX `categories_store_idx` ON `categories` (`storeId`);
CREATE UNIQUE INDEX `categories_store_slug_unique` ON `categories` (`storeId`,`slug`);
CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`);

ALTER TABLE `store_settings` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
UPDATE `store_settings`
SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0)
WHERE `storeId` IS NULL;
ALTER TABLE `store_settings` MODIFY `storeId` int NOT NULL DEFAULT 0;
DROP INDEX `store_settings_key_unique` ON `store_settings`;
CREATE INDEX `store_settings_store_idx` ON `store_settings` (`storeId`);
CREATE UNIQUE INDEX `store_settings_store_key_unique` ON `store_settings` (`storeId`,`key`);

ALTER TABLE `upsells` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `raffles` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `delivery_zones` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `menu_slides` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `carousel_images` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `notification_templates` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;
ALTER TABLE `scheduled_notifications` ADD COLUMN IF NOT EXISTS `storeId` int NULL AFTER `id`;

UPDATE `upsells` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `promotions` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `raffles` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `delivery_zones` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `menu_slides` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `carousel_images` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `notification_templates` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;
UPDATE `scheduled_notifications` SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0) WHERE `storeId` IS NULL;

ALTER TABLE `upsells` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `promotions` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `raffles` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `delivery_zones` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `menu_slides` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `carousel_images` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `notification_templates` MODIFY `storeId` int NOT NULL DEFAULT 0;
ALTER TABLE `scheduled_notifications` MODIFY `storeId` int NOT NULL DEFAULT 0;

CREATE INDEX `upsells_store_idx` ON `upsells` (`storeId`);
CREATE INDEX `promotions_store_idx` ON `promotions` (`storeId`);
CREATE INDEX `raffles_store_idx` ON `raffles` (`storeId`);
CREATE INDEX `delivery_zones_store_idx` ON `delivery_zones` (`storeId`);
CREATE INDEX `delivery_zones_store_neighborhood_idx` ON `delivery_zones` (`storeId`,`neighborhood`);
CREATE INDEX `menu_slides_store_idx` ON `menu_slides` (`storeId`);
CREATE INDEX `carousel_images_store_idx` ON `carousel_images` (`storeId`);
CREATE INDEX `notification_templates_store_idx` ON `notification_templates` (`storeId`);
CREATE INDEX `notification_templates_store_event_channel_idx` ON `notification_templates` (`storeId`,`event`,`channel`);
CREATE INDEX `scheduled_notifications_store_idx` ON `scheduled_notifications` (`storeId`);
CREATE INDEX `scheduled_notifications_store_scheduled_status_idx` ON `scheduled_notifications` (`storeId`,`scheduledAt`,`status`);

DROP INDEX `promotions_external_uq` ON `promotions`;
CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`);

UPDATE `products`
SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0)
WHERE `storeId` IS NULL;
ALTER TABLE `products` MODIFY `storeId` int NOT NULL DEFAULT 0;
DROP INDEX `products_external_uq` ON `products`;
CREATE UNIQUE INDEX `products_external_uq` ON `products` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`);

UPDATE `coupons`
SET `storeId` = COALESCE((SELECT `id` FROM (SELECT `id` FROM `stores` ORDER BY `isDefault` DESC, `id` LIMIT 1) default_store), 0)
WHERE `storeId` IS NULL;
ALTER TABLE `coupons` MODIFY `storeId` int NOT NULL DEFAULT 0;
DROP INDEX `coupons_code_unique` ON `coupons`;
DROP INDEX `coupons_external_uq` ON `coupons`;
CREATE INDEX `coupons_store_idx` ON `coupons` (`storeId`);
CREATE UNIQUE INDEX `coupons_store_code_unique` ON `coupons` (`storeId`,`code`);
CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`storeId`,`externalSource`,`externalMerchantId`,`externalId`);
