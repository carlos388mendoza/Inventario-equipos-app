CREATE TABLE `equipment_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`type` text NOT NULL,
	`equipment_id` text NOT NULL,
	`counterpart_equipment_id` text,
	`from_restaurant_id` text,
	`to_restaurant_id` text,
	`asset_code` text NOT NULL,
	`equipment_type_id` text,
	`reason` text,
	`notes` text,
	`performed_by` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counterpart_equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_type_id`) REFERENCES `equipment_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equipment_movements_batch_idx` ON `equipment_movements` (`batch_id`);--> statement-breakpoint
CREATE INDEX `equipment_movements_equipment_idx` ON `equipment_movements` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `equipment_movements_counterpart_idx` ON `equipment_movements` (`counterpart_equipment_id`);--> statement-breakpoint
CREATE INDEX `equipment_movements_type_idx` ON `equipment_movements` (`type`);--> statement-breakpoint
CREATE INDEX `equipment_movements_from_idx` ON `equipment_movements` (`from_restaurant_id`);--> statement-breakpoint
CREATE INDEX `equipment_movements_to_idx` ON `equipment_movements` (`to_restaurant_id`);--> statement-breakpoint
CREATE INDEX `equipment_movements_created_at_idx` ON `equipment_movements` (`createdAt`);--> statement-breakpoint
ALTER TABLE `equipment` ADD `owner_restaurant_id` text REFERENCES restaurants(id);--> statement-breakpoint
ALTER TABLE `equipment` ADD `origin_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `equipment` ADD `replaced_by_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
CREATE INDEX `equipment_owner_restaurant_idx` ON `equipment` (`owner_restaurant_id`);--> statement-breakpoint
CREATE INDEX `equipment_origin_idx` ON `equipment` (`origin_equipment_id`);--> statement-breakpoint
CREATE INDEX `equipment_replaced_by_idx` ON `equipment` (`replaced_by_equipment_id`);