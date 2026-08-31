CREATE TABLE `portfolio_images` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`alt` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`lqip` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `portfolio_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `portfolio_images_item_idx` ON `portfolio_images` (`item_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `portfolio_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`information` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`y` real DEFAULT 0 NOT NULL,
	`width` real DEFAULT 30 NOT NULL,
	`z` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_items_slug_idx` ON `portfolio_items` (`slug`);--> statement-breakpoint
CREATE INDEX `portfolio_items_status_idx` ON `portfolio_items` (`status`);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `home_title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `home_blurb` text DEFAULT '' NOT NULL;