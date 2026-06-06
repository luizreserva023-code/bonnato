CREATE TABLE `automation_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(60) NOT NULL,
	`userId` int,
	`orderId` int,
	`cartId` int,
	`channel` enum('whatsapp','push','email') NOT NULL,
	`step` int,
	`status` enum('sent','delivered','read','converted','failed') NOT NULL,
	`abVariant` varchar(2),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automation_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `abandoned_carts` ADD `orderId` int;--> statement-breakpoint
ALTER TABLE `abandoned_carts` ADD `currentStep` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `abandoned_carts` ADD `couponCode` varchar(60);--> statement-breakpoint
ALTER TABLE `abandoned_carts` ADD `thirdReminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `journey_executions` ADD `lastMessageAt` timestamp;--> statement-breakpoint
ALTER TABLE `journey_executions` ADD `convertedAt` timestamp;--> statement-breakpoint
ALTER TABLE `journey_executions` ADD `conversionOrderId` int;--> statement-breakpoint
CREATE INDEX `automation_events_user_idx` ON `automation_events` (`userId`);--> statement-breakpoint
CREATE INDEX `automation_events_type_step_idx` ON `automation_events` (`type`,`step`);--> statement-breakpoint
CREATE INDEX `automation_events_created_idx` ON `automation_events` (`createdAt`);