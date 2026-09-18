CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`role` text DEFAULT 'RESTAURANT_USER' NOT NULL,
	`restaurantId` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_code` text NOT NULL,
	`serial_number` text,
	`equipment_type_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`brand` text,
	`model` text,
	`purchase_date` integer,
	`installation_date` integer,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`notes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_asset_code_unique` ON `equipment` (`asset_code`);--> statement-breakpoint
CREATE INDEX `equipment_restaurant_idx` ON `equipment` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `equipment_type_idx` ON `equipment` (`equipment_type_id`);--> statement-breakpoint
CREATE INDEX `equipment_status_idx` ON `equipment` (`status`);--> statement-breakpoint
CREATE INDEX `equipment_serial_idx` ON `equipment` (`serial_number`);--> statement-breakpoint
CREATE TABLE `equipment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`restaurant_id` text,
	`action` text NOT NULL,
	`description` text,
	`performed_by` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equipment_history_equipment_idx` ON `equipment_history` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `equipment_history_restaurant_idx` ON `equipment_history` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `equipment_history_created_at_idx` ON `equipment_history` (`createdAt`);--> statement-breakpoint
CREATE TABLE `equipment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`equipment_type_id` text NOT NULL,
	`current_equipment_id` text,
	`reason` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requests_restaurant_idx` ON `equipment_requests` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `requests_requested_by_idx` ON `equipment_requests` (`requested_by`);--> statement-breakpoint
CREATE INDEX `requests_type_idx` ON `equipment_requests` (`equipment_type_id`);--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `equipment_requests` (`status`);--> statement-breakpoint
CREATE INDEX `requests_priority_idx` ON `equipment_requests` (`priority`);--> statement-breakpoint
CREATE INDEX `requests_created_at_idx` ON `equipment_requests` (`createdAt`);--> statement-breakpoint
CREATE TABLE `equipment_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`useful_life_months` integer DEFAULT 36 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equipment_types_name_idx` ON `equipment_types` (`name`);--> statement-breakpoint
CREATE TABLE `request_history` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text,
	`old_status` text,
	`new_status` text NOT NULL,
	`comment` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `equipment_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `request_history_request_idx` ON `request_history` (`request_id`);--> statement-breakpoint
CREATE INDEX `request_history_user_idx` ON `request_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `request_history_created_at_idx` ON `request_history` (`createdAt`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_code_unique` ON `restaurants` (`code`);--> statement-breakpoint
CREATE TABLE `security_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`equipment_id` text NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `security_labels_token_unique` ON `security_labels` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `security_labels_equipment_unique` ON `security_labels` (`equipment_id`);