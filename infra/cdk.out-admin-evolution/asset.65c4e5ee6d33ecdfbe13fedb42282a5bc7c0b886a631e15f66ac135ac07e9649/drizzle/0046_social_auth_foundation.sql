ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `firstName` varchar(160) NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `lastName` varchar(160) NULL AFTER `firstName`,
  ADD COLUMN IF NOT EXISTS `username` varchar(191) NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `profileCompleted` boolean NOT NULL DEFAULT false AFTER `emailVerified`;

ALTER TABLE `customer_auth_providers`
  ADD COLUMN IF NOT EXISTS `providerUsername` varchar(191) NULL AFTER `providerPhone`,
  ADD COLUMN IF NOT EXISTS `displayName` varchar(255) NULL AFTER `providerUsername`,
  ADD COLUMN IF NOT EXISTS `avatarUrl` text NULL AFTER `displayName`,
  ADD COLUMN IF NOT EXISTS `accountType` varchar(64) NULL AFTER `avatarUrl`,
  ADD COLUMN IF NOT EXISTS `accessTokenEncrypted` text NULL AFTER `accountType`,
  ADD COLUMN IF NOT EXISTS `refreshTokenEncrypted` text NULL AFTER `accessTokenEncrypted`,
  ADD COLUMN IF NOT EXISTS `tokenExpiresAt` timestamp NULL AFTER `refreshTokenEncrypted`,
  ADD COLUMN IF NOT EXISTS `grantedScopes` text NULL AFTER `tokenExpiresAt`,
  ADD COLUMN IF NOT EXISTS `rawProfileJson` text NULL AFTER `grantedScopes`,
  ADD COLUMN IF NOT EXISTS `consentVersion` varchar(32) NULL AFTER `isPrimary`,
  ADD COLUMN IF NOT EXISTS `consentedAt` timestamp NULL AFTER `consentVersion`,
  ADD COLUMN IF NOT EXISTS `lastSyncedAt` timestamp NULL AFTER `linkedAt`,
  ADD COLUMN IF NOT EXISTS `disconnectedAt` timestamp NULL AFTER `lastSyncedAt`;

CREATE TABLE IF NOT EXISTS `auth_event_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NULL,
  `provider` varchar(32) NULL,
  `event` enum('login_success','login_failure','provider_connected','provider_disconnected','profile_synced','account_deleted') NOT NULL,
  `ipAddress` varchar(64) NULL,
  `userAgent` text NULL,
  `metadataJson` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `auth_event_logs_user_created_idx` (`userId`,`createdAt`),
  KEY `auth_event_logs_event_created_idx` (`event`,`createdAt`)
);

CREATE TABLE IF NOT EXISTS `user_consents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `kind` enum('terms','privacy','social_sync') NOT NULL,
  `version` varchar(32) NOT NULL,
  `granted` boolean NOT NULL DEFAULT true,
  `ipAddress` varchar(64) NULL,
  `userAgent` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_consents_user_kind_created_idx` (`userId`,`kind`,`createdAt`)
);
