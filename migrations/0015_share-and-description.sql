/*
  The two settings columns behind the search description and the share image.

  Only the ALTERs: `drizzle-kit generate` also re-emitted `site_revisions` and
  `pending_media_deletions`, because 0014_publish.sql was written by hand and
  never entered the journal, so the meta snapshots had never heard of those
  tables. Applying those CREATEs would fail on every database that has already
  run 0014. The snapshot alongside this migration now carries them, so the next
  generate starts from the truth.
*/
ALTER TABLE `site_settings` ADD `site_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `share_image_key` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `share_image_width` integer;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `share_image_height` integer;
