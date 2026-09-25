CREATE TABLE `abandoned_carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customerName` varchar(200) NOT NULL,
	`customerPhone` varchar(30),
	`items` text NOT NULL,
	`total` varchar(20) NOT NULL,
	`status` enum('pending','recovered','expired') NOT NULL DEFAULT 'pending',
	`firstReminderSentAt` timestamp,
	`secondReminderSentAt` timestamp,
	`recoveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `abandoned_carts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tag` enum('novo','recorrente','indeciso','inativo_15','inativo_30','inativo_60') NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journey_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`journeyId` int NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(30),
	`status` enum('running','completed','cancelled','failed') NOT NULL DEFAULT 'running',
	`currentStep` int NOT NULL DEFAULT 0,
	`metadata` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`nextStepAt` timestamp,
	`completedAt` timestamp,
	`logs` text,
	CONSTRAINT `journey_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`trigger` enum('checkout_abandoned','tag_inativo_15','tag_inativo_30','tag_inativo_60','first_order','manual') NOT NULL,
	`status` enum('active','paused','draft') NOT NULL DEFAULT 'draft',
	`steps` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journeys_id` PRIMARY KEY(`id`)
);
