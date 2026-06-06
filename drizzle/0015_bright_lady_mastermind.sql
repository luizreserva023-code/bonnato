CREATE TABLE `menu_slides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`subtitle` varchar(300),
	`imageUrl` text,
	`badgeText` varchar(80),
	`ctaText` varchar(80),
	`ctaLink` varchar(500),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_slides_id` PRIMARY KEY(`id`)
);
