CREATE TABLE `artwork_images` (
	`id` text PRIMARY KEY NOT NULL,
	`artwork_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`alt` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`lqip` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`artwork_id`) REFERENCES `artworks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artwork_images_artwork_idx` ON `artwork_images` (`artwork_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `artworks` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`year` integer NOT NULL,
	`medium` text DEFAULT '' NOT NULL,
	`dimensions_note` text,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artworks_slug_idx` ON `artworks` (`slug`);--> statement-breakpoint
CREATE INDEX `artworks_status_sort_idx` ON `artworks` (`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`artwork_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`etsy_url` text NOT NULL,
	`price_pence` integer NOT NULL,
	`availability` text DEFAULT 'available' NOT NULL,
	`edition_size` integer,
	`edition_remaining` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`artwork_id`) REFERENCES `artworks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listings_artwork_idx` ON `listings` (`artwork_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`hero_artwork_id` text,
	`announcement` text,
	`etsy_shop_url` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`instagram_url` text DEFAULT '' NOT NULL
);
