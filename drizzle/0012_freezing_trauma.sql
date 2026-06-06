CREATE TABLE `notification_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event` enum('order_confirmed','order_preparing','order_out_for_delivery','order_delivered','order_cancelled') NOT NULL,
	`channel` enum('push','whatsapp','both') NOT NULL DEFAULT 'both',
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_templates_id` PRIMARY KEY(`id`)
);
