CREATE TABLE `loyalty_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderId` int,
	`type` enum('earn','redeem','manual') NOT NULL,
	`points` int NOT NULL,
	`description` varchar(255),
	`balanceBefore` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyalty_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `pointsDiscount` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `orders` ADD `pointsUsed` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `loyalty_tx_user_idx` ON `loyalty_transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `loyalty_tx_order_idx` ON `loyalty_transactions` (`orderId`);