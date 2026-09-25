ALTER TABLE `orders` ADD `ifoodOrderId` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `source` enum('app','ifood','whatsapp','phone') DEFAULT 'app';