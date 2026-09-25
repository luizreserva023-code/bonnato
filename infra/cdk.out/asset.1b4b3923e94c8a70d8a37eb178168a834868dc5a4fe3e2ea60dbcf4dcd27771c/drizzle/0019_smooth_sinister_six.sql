CREATE TABLE `custom_customer_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tagId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_customer_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#6b7280',
	`description` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_tags_name_unique` UNIQUE(`name`)
);
