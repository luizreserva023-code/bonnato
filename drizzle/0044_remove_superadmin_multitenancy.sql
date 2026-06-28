ALTER TABLE `users`
  MODIFY COLUMN `role` enum('user','admin','manager') NOT NULL DEFAULT 'user';

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `store_features`;
DROP TABLE IF EXISTS `store_themes`;
DROP TABLE IF EXISTS `user_store_roles`;

DROP INDEX `stores_subdomain_idx` ON `stores`;
DROP INDEX `stores_domain_idx` ON `stores`;

ALTER TABLE `stores`
  DROP COLUMN `subdomain`,
  DROP COLUMN `domain`,
  DROP COLUMN `plan`;
