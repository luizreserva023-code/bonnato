CREATE TABLE `order_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`userId` int NOT NULL,
	`senderRole` enum('customer','admin') NOT NULL,
	`message` varchar(1000) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_messages_id` PRIMARY KEY(`id`)
);
