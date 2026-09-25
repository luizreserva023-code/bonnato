CREATE TABLE `club_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`plan` enum('bonattao','basico') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`pixCode` text,
	`pixQrCode` text,
	`status` enum('pending','paid','expired') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `club_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `clubPlan` enum('bonattao','basico');--> statement-breakpoint
ALTER TABLE `users` ADD `clubStatus` enum('active','pending','cancelled');--> statement-breakpoint
ALTER TABLE `users` ADD `clubStartDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `clubNextBillingDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `clubFreePizzaUsed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `clubFreePizzaResetAt` timestamp;