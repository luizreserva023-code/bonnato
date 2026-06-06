-- 0037_audit_hardening.sql
-- Tabelas e índices adicionais para mitigar falhas apontadas na auditoria:
--   * idempotência de webhooks (Stripe/Asaas)
--   * idempotência de crédito de pontos por pedido
--   * ledger de uso de cupom por pedido (para estorno em cancelamento)
--   * unique em transações por (orderId, stripePaymentIntentId)
--   * index em users(phone) para resolução de webhooks de automação

CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` enum('stripe','asaas') NOT NULL,
  `eventId` varchar(255) NOT NULL,
  `eventType` varchar(120) DEFAULT NULL,
  `processedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `webhook_events_provider_event_uq` (`provider`, `eventId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `loyalty_order_credits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orderId` int NOT NULL,
  `userId` int NOT NULL,
  `points` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loyalty_order_credits_order_uq` (`orderId`),
  KEY `loyalty_order_credits_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `couponId` int NOT NULL,
  `code` varchar(50) NOT NULL,
  `orderId` int NOT NULL,
  `userId` int DEFAULT NULL,
  `reverted` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_redemptions_order_uq` (`orderId`),
  KEY `coupon_redemptions_coupon_idx` (`couponId`),
  KEY `coupon_redemptions_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Unique por (orderId, stripePaymentIntentId) para evitar duplicatas em retries
ALTER TABLE `transactions`
  ADD UNIQUE KEY `transactions_order_intent_uq` (`orderId`, `stripePaymentIntentId`);

-- Índice em users.phone (normalizado) para webhook de automação
ALTER TABLE `users` ADD INDEX `users_phone_idx` (`phone`);

-- Índice em categories para ORDER BY sortOrder + active
ALTER TABLE `categories` ADD INDEX `categories_active_order_idx` (`active`, `sortOrder`);
