CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`imageUrl` text,
	`couponCode` varchar(50),
	`active` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `raffle_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raffleId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `raffle_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `raffles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`prize` varchar(300) NOT NULL,
	`imageUrl` text,
	`status` enum('active','closed','drawn') NOT NULL DEFAULT 'active',
	`winnerId` int,
	`winnerName` varchar(200),
	`drawDate` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `raffles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `upsells` (
	`id` int AUTO_INCREMENT NOT NULL,
	`suggestedProductId` int NOT NULL,
	`triggerProductId` int,
	`triggerMinTotal` decimal(10,2),
	`type` enum('upsell','downsell') NOT NULL DEFAULT 'upsell',
	`title` varchar(200) NOT NULL,
	`description` text,
	`discountPercent` int DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `upsells_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coupons` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `savedAddress` text;--> statement-breakpoint
ALTER TABLE `users` ADD `savedCep` varchar(10);--> statement-breakpoint
ALTER TABLE `users` ADD `savedCity` varchar(100);