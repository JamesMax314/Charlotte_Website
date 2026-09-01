CREATE TABLE `site_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hash` text NOT NULL,
	`snapshot` text NOT NULL,
	`published_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_revisions_published_idx` ON `site_revisions` (`published_at`);--> statement-breakpoint
CREATE TABLE `pending_media_deletions` (
	`storage_key` text PRIMARY KEY NOT NULL
);
