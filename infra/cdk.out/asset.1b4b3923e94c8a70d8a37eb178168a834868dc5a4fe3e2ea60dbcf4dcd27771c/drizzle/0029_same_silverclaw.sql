CREATE TABLE `store_managers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_managers_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_managers_unique` UNIQUE(`storeId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`city` varchar(100) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`active` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `stores_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','manager') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `coupons` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `drivers` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `storeId` int;--> statement-breakpoint
CREATE INDEX `store_managers_store_idx` ON `store_managers` (`storeId`);--> statement-breakpoint
CREATE INDEX `store_managers_user_idx` ON `store_managers` (`userId`);--> statement-breakpoint
CREATE INDEX `stores_active_idx` ON `stores` (`active`);--> statement-breakpoint
CREATE INDEX `drivers_store_idx` ON `drivers` (`storeId`);--> statement-breakpoint
CREATE INDEX `orders_store_idx` ON `orders` (`storeId`);--> statement-breakpoint
CREATE INDEX `products_store_idx` ON `products` (`storeId`);