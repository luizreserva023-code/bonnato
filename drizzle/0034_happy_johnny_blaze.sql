ALTER TABLE `orders` ADD `nfceKey` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `nfceStatus` enum('pending','authorized','cancelled','error');--> statement-breakpoint
ALTER TABLE `orders` ADD `nfceUrl` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `customerCpf` varchar(14);--> statement-breakpoint
ALTER TABLE `stores` ADD `cnpj` varchar(18);--> statement-breakpoint
ALTER TABLE `stores` ADD `inscricaoEstadual` varchar(30);--> statement-breakpoint
ALTER TABLE `stores` ADD `regimeTributario` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `stores` ADD `csc` varchar(100);--> statement-breakpoint
ALTER TABLE `stores` ADD `cscId` varchar(10);--> statement-breakpoint
ALTER TABLE `stores` ADD `focusNfeToken` varchar(200);--> statement-breakpoint
ALTER TABLE `stores` ADD `nfceEnabled` boolean DEFAULT false NOT NULL;