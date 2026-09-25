ALTER TABLE `journeys` MODIFY COLUMN `trigger` enum('checkout_abandoned','tag_inativo_15','tag_inativo_30','tag_inativo_60','tag_inativo_custom','first_order','new_user','club_subscriber','manual','order_delivered','order_cancelled','birthday','loyalty_milestone','rating_submitted','rating_negative','club_expiring','first_order_month') NOT NULL;--> statement-breakpoint
ALTER TABLE `journey_executions` ADD `abGroup` varchar(1);--> statement-breakpoint
ALTER TABLE `journey_executions` ADD `adminTaskTitle` varchar(200);--> statement-breakpoint
ALTER TABLE `journeys` ADD `daysInactive` int;--> statement-breakpoint
ALTER TABLE `journeys` ADD `exitOnOrder` boolean DEFAULT false NOT NULL;