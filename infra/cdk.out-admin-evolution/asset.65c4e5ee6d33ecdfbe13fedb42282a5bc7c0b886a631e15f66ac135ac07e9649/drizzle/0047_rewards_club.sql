ALTER TABLE `reward_catalog`
  ADD COLUMN `category` varchar(80) NULL AFTER `productId`,
  ADD COLUMN `icon` varchar(64) NULL AFTER `category`,
  ADD COLUMN `imageUrl` text NULL AFTER `icon`,
  ADD COLUMN `badgeText` varchar(64) NULL AFTER `imageUrl`,
  ADD COLUMN `buttonText` varchar(64) NOT NULL DEFAULT 'Resgatar' AFTER `badgeText`,
  ADD COLUMN `stock` int NULL AFTER `buttonText`,
  ADD COLUMN `totalRedemptions` int NOT NULL DEFAULT 0 AFTER `stock`,
  ADD COLUMN `maxRedemptionsPerUser` int NULL AFTER `totalRedemptions`,
  ADD COLUMN `featured` boolean NOT NULL DEFAULT true AFTER `active`,
  ADD COLUMN `sortOrder` int NOT NULL DEFAULT 0 AFTER `featured`,
  ADD COLUMN `startsAt` timestamp NULL AFTER `sortOrder`,
  ADD COLUMN `expiresAt` timestamp NULL AFTER `startsAt`,
  ADD COLUMN `archivedAt` timestamp NULL AFTER `expiresAt`,
  ADD COLUMN `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `createdAt`;

CREATE INDEX `reward_catalog_display_idx`
  ON `reward_catalog` (`storeId`, `archivedAt`, `sortOrder`);

ALTER TABLE `reward_catalog`
  ADD CONSTRAINT `reward_catalog_stock_nonnegative_chk`
  CHECK (`stock` IS NULL OR `stock` >= 0),
  ADD CONSTRAINT `reward_catalog_redemptions_nonnegative_chk`
  CHECK (`totalRedemptions` >= 0);

ALTER TABLE `loyalty_transactions`
  MODIFY COLUMN `type` enum('earn','redeem','refund','adjustment','manual') NOT NULL;

ALTER TABLE `tenant_customer_accounts`
  ADD CONSTRAINT `tenant_customer_accounts_points_nonnegative_chk`
  CHECK (`loyaltyPoints` >= 0);

CREATE TABLE `reward_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `storeId` int NOT NULL,
  `rewardId` int NOT NULL,
  `userId` int NOT NULL,
  `couponId` int NULL,
  `pointsSpent` int NOT NULL,
  `status` enum('pending','completed','cancelled','refunded','expired') NOT NULL DEFAULT 'pending',
  `idempotencyKey` varchar(96) NOT NULL,
  `redeemedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NULL,
  `cancelledAt` timestamp NULL,
  `cancellationReason` varchar(500) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reward_redemptions_idempotency_uq` (`storeId`, `userId`, `idempotencyKey`),
  UNIQUE KEY `reward_redemptions_coupon_uq` (`couponId`),
  KEY `reward_redemptions_reward_idx` (`rewardId`, `status`),
  KEY `reward_redemptions_user_idx` (`userId`, `status`),
  CONSTRAINT `reward_redemptions_points_chk` CHECK (`pointsSpent` >= 0)
);

CREATE TABLE `reward_coupons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `storeId` int NOT NULL,
  `rewardId` int NOT NULL,
  `code` varchar(64) NOT NULL,
  `status` enum('available','reserved','redeemed','used','expired','cancelled') NOT NULL DEFAULT 'available',
  `assignedUserId` int NULL,
  `redemptionId` int NULL,
  `reservedAt` timestamp NULL,
  `redeemedAt` timestamp NULL,
  `usedAt` timestamp NULL,
  `expiresAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reward_coupons_store_code_uq` (`storeId`, `code`),
  UNIQUE KEY `reward_coupons_redemption_uq` (`redemptionId`),
  KEY `reward_coupons_reward_status_idx` (`rewardId`, `status`),
  KEY `reward_coupons_user_idx` (`assignedUserId`)
);

ALTER TABLE `reward_redemptions`
  ADD CONSTRAINT `reward_redemptions_coupon_fk`
  FOREIGN KEY (`couponId`) REFERENCES `reward_coupons` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `reward_coupons`
  ADD CONSTRAINT `reward_coupons_redemption_fk`
  FOREIGN KEY (`redemptionId`) REFERENCES `reward_redemptions` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE `reward_coupon_usages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `storeId` int NOT NULL,
  `couponId` int NOT NULL,
  `redemptionId` int NOT NULL,
  `userId` int NOT NULL,
  `orderId` int NOT NULL,
  `usedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reward_coupon_usages_coupon_uq` (`couponId`),
  UNIQUE KEY `reward_coupon_usages_order_uq` (`orderId`),
  KEY `reward_coupon_usages_user_idx` (`userId`, `usedAt`),
  CONSTRAINT `reward_coupon_usages_coupon_fk` FOREIGN KEY (`couponId`) REFERENCES `reward_coupons` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `reward_coupon_usages_redemption_fk` FOREIGN KEY (`redemptionId`) REFERENCES `reward_redemptions` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
);
