CREATE TABLE `scheduled_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`channel` enum('push','whatsapp','both') NOT NULL DEFAULT 'push',
	`targetAudience` enum('all','active','inactive','club') NOT NULL DEFAULT 'all',
	`scheduledAt` timestamp NOT NULL,
	`recurrence` enum('once','daily','weekly') NOT NULL DEFAULT 'once',
	`status` enum('pending','sent','cancelled','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`sentCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_notifications_id` PRIMARY KEY(`id`)
);
