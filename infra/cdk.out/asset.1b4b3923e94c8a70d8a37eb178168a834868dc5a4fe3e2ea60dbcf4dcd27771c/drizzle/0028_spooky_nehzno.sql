ALTER TABLE `custom_customer_tags` ADD CONSTRAINT `custom_customer_tags_unique` UNIQUE(`userId`,`tagId`);--> statement-breakpoint
ALTER TABLE `customer_tags` ADD CONSTRAINT `customer_tags_unique` UNIQUE(`userId`,`tag`);--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_unique` UNIQUE(`userId`,`productId`);--> statement-breakpoint
ALTER TABLE `raffle_entries` ADD CONSTRAINT `raffle_entries_unique` UNIQUE(`raffleId`,`userId`);--> statement-breakpoint
CREATE INDEX `abandoned_carts_user_idx` ON `abandoned_carts` (`userId`);--> statement-breakpoint
CREATE INDEX `abandoned_carts_status_expires_idx` ON `abandoned_carts` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `client_notifications_user_idx` ON `client_notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `client_notifications_user_read_idx` ON `client_notifications` (`userId`,`read`);--> statement-breakpoint
CREATE INDEX `client_notifications_created_at_idx` ON `client_notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `club_payments_user_idx` ON `club_payments` (`userId`);--> statement-breakpoint
CREATE INDEX `club_payments_status_idx` ON `club_payments` (`status`);--> statement-breakpoint
CREATE INDEX `coupons_user_idx` ON `coupons` (`userId`);--> statement-breakpoint
CREATE INDEX `custom_customer_tags_user_idx` ON `custom_customer_tags` (`userId`);--> statement-breakpoint
CREATE INDEX `custom_customer_tags_tag_idx` ON `custom_customer_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `customer_tags_user_idx` ON `customer_tags` (`userId`);--> statement-breakpoint
CREATE INDEX `customer_tags_tag_idx` ON `customer_tags` (`tag`);--> statement-breakpoint
CREATE INDEX `delivery_ratings_driver_idx` ON `delivery_ratings` (`driverId`);--> statement-breakpoint
CREATE INDEX `delivery_ratings_user_idx` ON `delivery_ratings` (`userId`);--> statement-breakpoint
CREATE INDEX `driver_locations_driver_idx` ON `driver_locations` (`driverId`);--> statement-breakpoint
CREATE INDEX `driver_locations_order_idx` ON `driver_locations` (`orderId`);--> statement-breakpoint
CREATE INDEX `driver_locations_driver_updated_idx` ON `driver_locations` (`driverId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `driver_push_subscriptions_driver_idx` ON `driver_push_subscriptions` (`driverId`);--> statement-breakpoint
CREATE INDEX `favorites_user_idx` ON `favorites` (`userId`);--> statement-breakpoint
CREATE INDEX `journey_executions_journey_idx` ON `journey_executions` (`journeyId`);--> statement-breakpoint
CREATE INDEX `journey_executions_user_idx` ON `journey_executions` (`userId`);--> statement-breakpoint
CREATE INDEX `journey_executions_status_next_idx` ON `journey_executions` (`status`,`nextStepAt`);--> statement-breakpoint
CREATE INDEX `journeys_status_idx` ON `journeys` (`status`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_items_product_idx` ON `order_items` (`productId`);--> statement-breakpoint
CREATE INDEX `order_messages_order_idx` ON `order_messages` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_messages_order_created_idx` ON `order_messages` (`orderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_driver_idx` ON `orders` (`driverId`);--> statement-breakpoint
CREATE INDEX `orders_created_at_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_user_status_idx` ON `orders` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`categoryId`);--> statement-breakpoint
CREATE INDEX `products_active_idx` ON `products` (`active`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `raffle_entries_raffle_idx` ON `raffle_entries` (`raffleId`);--> statement-breakpoint
CREATE INDEX `raffle_entries_user_idx` ON `raffle_entries` (`userId`);--> statement-breakpoint
CREATE INDEX `scheduled_notifications_scheduled_status_idx` ON `scheduled_notifications` (`scheduledAt`,`status`);--> statement-breakpoint
CREATE INDEX `scheduled_notifications_status_idx` ON `scheduled_notifications` (`status`);--> statement-breakpoint
CREATE INDEX `transactions_order_idx` ON `transactions` (`orderId`);--> statement-breakpoint
CREATE INDEX `user_addresses_user_idx` ON `user_addresses` (`userId`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_reset_token_idx` ON `users` (`resetToken`);