ALTER TABLE `site_settings` ADD `gutter_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `gutter` real DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `snap_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `show_names_on_hover` integer DEFAULT true NOT NULL;