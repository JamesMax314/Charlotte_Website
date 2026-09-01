CREATE TABLE `site_fonts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`family` text NOT NULL,
	`storage_key` text NOT NULL,
	`format` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `site_settings` ADD `site_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `favicon_key` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `accent_colour` text DEFAULT '#9a5b33' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `about_copy` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `about_photo_key` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `about_photo_alt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `about_photo_width` integer;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `about_photo_height` integer;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `about_photo_lqip` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `contact_copy` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `privacy_copy` text DEFAULT '' NOT NULL;