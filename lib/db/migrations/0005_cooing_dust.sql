CREATE TABLE `request_confirmation_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`token` text NOT NULL,
	`purpose` text DEFAULT 'INSTALLATION_FOLLOWUP' NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `equipment_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_confirmation_tokens_token_unique` ON `request_confirmation_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `request_confirmation_tokens_request_idx` ON `request_confirmation_tokens` (`request_id`);--> statement-breakpoint
CREATE TABLE `request_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`type` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`provider` text,
	`error` text,
	`createdAt` integer NOT NULL,
	`sentAt` integer,
	FOREIGN KEY (`request_id`) REFERENCES `equipment_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `request_notifications_request_idx` ON `request_notifications` (`request_id`);--> statement-breakpoint
CREATE INDEX `request_notifications_type_idx` ON `request_notifications` (`type`);--> statement-breakpoint
CREATE INDEX `request_notifications_status_idx` ON `request_notifications` (`status`);--> statement-breakpoint
CREATE TABLE `user_restaurant_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_restaurant_assignments_unique` ON `user_restaurant_assignments` (`user_id`,`restaurant_id`);--> statement-breakpoint
CREATE INDEX `user_restaurant_assignments_user_idx` ON `user_restaurant_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_restaurant_assignments_restaurant_idx` ON `user_restaurant_assignments` (`restaurant_id`);--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `destination_area` text;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `installation_status` text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `follow_up_due_at` integer;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `follow_up_sent_at` integer;--> statement-breakpoint
ALTER TABLE `equipment_requests` ADD `installation_confirmed_at` integer;--> statement-breakpoint
CREATE INDEX `requests_installation_status_idx` ON `equipment_requests` (`installation_status`);--> statement-breakpoint
CREATE INDEX `requests_follow_up_due_idx` ON `equipment_requests` (`follow_up_due_at`);