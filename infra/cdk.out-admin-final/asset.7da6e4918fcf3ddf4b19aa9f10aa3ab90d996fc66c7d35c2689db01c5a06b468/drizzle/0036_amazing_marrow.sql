CREATE TABLE `client_alert_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_alert_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_alert_reads_alert_user_idx` UNIQUE(`alertId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `client_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('promotion','raffle','coupon','club','custom') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`icon` varchar(10) DEFAULT '🔔',
	`url` varchar(500),
	`storeId` int,
	`active` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `client_alert_reads_user_idx` ON `client_alert_reads` (`userId`);--> statement-breakpoint
CREATE INDEX `client_alerts_type_idx` ON `client_alerts` (`type`);--> statement-breakpoint
CREATE INDEX `client_alerts_active_idx` ON `client_alerts` (`active`);--> statement-breakpoint
CREATE INDEX `client_alerts_created_idx` ON `client_alerts` (`createdAt`);