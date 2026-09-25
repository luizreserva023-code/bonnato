CREATE TABLE `coupon_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`couponId` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`orderId` int NOT NULL,
	`userId` int,
	`reverted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupon_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupon_redemptions_order_uq` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_order_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`userId` int NOT NULL,
	`points` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyalty_order_credits_id` PRIMARY KEY(`id`),
	CONSTRAINT `loyalty_order_credits_order_uq` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('stripe','asaas') NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(120),
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_provider_event_uq` UNIQUE(`provider`,`eventId`)
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_order_intent_uq` UNIQUE(`orderId`,`stripePaymentIntentId`);--> statement-breakpoint
CREATE INDEX `coupon_redemptions_coupon_idx` ON `coupon_redemptions` (`couponId`);--> statement-breakpoint
CREATE INDEX `coupon_redemptions_user_idx` ON `coupon_redemptions` (`userId`);--> statement-breakpoint
CREATE INDEX `loyalty_order_credits_user_idx` ON `loyalty_order_credits` (`userId`);--> statement-breakpoint
CREATE INDEX `categories_active_order_idx` ON `categories` (`active`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `users_phone_idx` ON `users` (`phone`);