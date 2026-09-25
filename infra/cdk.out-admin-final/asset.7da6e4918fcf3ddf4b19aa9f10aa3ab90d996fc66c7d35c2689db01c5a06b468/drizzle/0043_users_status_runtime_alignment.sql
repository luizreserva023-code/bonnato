ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `status` enum('active','inactive','suspended','setup_pending') NOT NULL DEFAULT 'active' AFTER `phone`;
