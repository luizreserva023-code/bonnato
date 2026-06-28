ALTER TABLE `users`
  MODIFY COLUMN `role` enum('user','admin','manager','super_admin') NOT NULL DEFAULT 'user';

ALTER TABLE `stores`
  ADD COLUMN `displayName` varchar(200),
  ADD COLUMN `document` varchar(32),
  ADD COLUMN `email` varchar(320),
  ADD COLUMN `status` enum('active','inactive','suspended','setup_pending') NOT NULL DEFAULT 'active',
  ADD COLUMN `domain` varchar(191),
  ADD COLUMN `subdomain` varchar(100),
  ADD COLUMN `plan` enum('basic','pro','enterprise','custom') NOT NULL DEFAULT 'basic';

CREATE INDEX `stores_status_idx` ON `stores` (`status`);
CREATE UNIQUE INDEX `stores_subdomain_idx` ON `stores` (`subdomain`);
CREATE UNIQUE INDEX `stores_domain_idx` ON `stores` (`domain`);

CREATE TABLE `user_store_roles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `storeId` int NOT NULL,
  `role` enum('store_owner','store_admin','manager','attendant','kitchen','waiter','driver','customer') NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_store_roles_id` PRIMARY KEY(`id`)
);
CREATE INDEX `user_store_roles_user_idx` ON `user_store_roles` (`userId`);
CREATE INDEX `user_store_roles_store_idx` ON `user_store_roles` (`storeId`);
CREATE INDEX `user_store_roles_role_idx` ON `user_store_roles` (`role`);
CREATE UNIQUE INDEX `user_store_roles_unique` ON `user_store_roles` (`userId`,`storeId`,`role`);

CREATE TABLE `store_themes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int NOT NULL,
  `logoUrl` text,
  `faviconUrl` text,
  `bannerUrl` text,
  `primaryColor` varchar(20) NOT NULL DEFAULT '#6E0D12',
  `secondaryColor` varchar(20) NOT NULL DEFAULT '#9b1520',
  `accentColor` varchar(20) NOT NULL DEFAULT '#f5b8b8',
  `backgroundColor` varchar(20) NOT NULL DEFAULT '#ffffff',
  `textColor` varchar(20) NOT NULL DEFAULT '#1f1f1f',
  `loginTitle` varchar(200),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `store_themes_id` PRIMARY KEY(`id`)
);
CREATE UNIQUE INDEX `store_themes_store_unique` ON `store_themes` (`storeId`);

CREATE TABLE `store_features` (
  `id` int AUTO_INCREMENT NOT NULL,
  `storeId` int NOT NULL,
  `featureKey` varchar(80) NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `store_features_id` PRIMARY KEY(`id`)
);
CREATE INDEX `store_features_store_idx` ON `store_features` (`storeId`);
CREATE UNIQUE INDEX `store_features_unique` ON `store_features` (`storeId`,`featureKey`);

CREATE TABLE `audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actorUserId` int,
  `actorRole` varchar(64),
  `storeId` int,
  `action` varchar(120) NOT NULL,
  `entity` varchar(120) NOT NULL,
  `entityId` varchar(120),
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorUserId`);
CREATE INDEX `audit_logs_store_idx` ON `audit_logs` (`storeId`);
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`createdAt`);
