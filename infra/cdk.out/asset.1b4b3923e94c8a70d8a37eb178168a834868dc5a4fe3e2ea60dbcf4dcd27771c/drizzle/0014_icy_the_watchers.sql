CREATE TABLE `delivery_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`neighborhood` varchar(200) NOT NULL,
	`city` varchar(200) NOT NULL DEFAULT '',
	`deliveryFee` decimal(8,2) NOT NULL DEFAULT '0.00',
	`estimatedMinutes` int NOT NULL DEFAULT 45,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_zones_id` PRIMARY KEY(`id`)
);
