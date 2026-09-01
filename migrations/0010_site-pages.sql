CREATE TABLE `site_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`nav_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_pages_slug_idx` ON `site_pages` (`slug`);--> statement-breakpoint
CREATE INDEX `site_pages_nav_idx` ON `site_pages` (`status`,`nav_order`);--> statement-breakpoint
ALTER TABLE `portfolio_items` ADD `page_id` text REFERENCES site_pages(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `portfolio_items_page_idx` ON `portfolio_items` (`page_id`,`z`);--> statement-breakpoint
ALTER TABLE `wall_texts` ADD `page_id` text REFERENCES site_pages(id) ON DELETE CASCADE;