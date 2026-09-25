CREATE TABLE `delivery_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`driverId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_ratings_orderId_unique` UNIQUE(`orderId`)
);
