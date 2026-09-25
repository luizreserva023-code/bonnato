ALTER TABLE `categories`
  ADD `externalSource` varchar(32),
  ADD `externalMerchantId` varchar(128),
  ADD `externalId` varchar(128);
--> statement-breakpoint
ALTER TABLE `products`
  ADD `externalSource` varchar(32),
  ADD `externalMerchantId` varchar(128),
  ADD `externalId` varchar(128),
  ADD `externalCode` varchar(128);
--> statement-breakpoint
ALTER TABLE `coupons`
  ADD `externalSource` varchar(32),
  ADD `externalMerchantId` varchar(128),
  ADD `externalId` varchar(128);
--> statement-breakpoint
ALTER TABLE `promotions`
  ADD `externalSource` varchar(32),
  ADD `externalMerchantId` varchar(128),
  ADD `externalId` varchar(128);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_external_uq` ON `categories` (`externalSource`,`externalMerchantId`,`externalId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_external_uq` ON `products` (`externalSource`,`externalMerchantId`,`externalId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_external_uq` ON `coupons` (`externalSource`,`externalMerchantId`,`externalId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotions_external_uq` ON `promotions` (`externalSource`,`externalMerchantId`,`externalId`);
