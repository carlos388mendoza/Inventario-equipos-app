CREATE TABLE `equipment_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`source_format` text DEFAULT 'AGGREGATE' NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`total_value` integer,
	`currency` text,
	`source_line_code` text,
	`source_document` text,
	`notes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equipment_groups_restaurant_idx` ON `equipment_groups` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `equipment_groups_source_document_idx` ON `equipment_groups` (`source_document`);--> statement-breakpoint
ALTER TABLE `equipment` ADD `source_document` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `source_short_code` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `source_description` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `source_qr_code` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `source_technician` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `source_date_text` text;--> statement-breakpoint
CREATE INDEX `equipment_source_document_idx` ON `equipment` (`source_document`);