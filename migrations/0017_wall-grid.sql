/*
  The alignment grid laid over a wall in the editor.

  Editor-only settings: no snapshot column reads them, so an existing live
  revision is unaffected and the grid appears switched off until the artist
  turns it on. Twelve columns is the default because it divides by four, which
  is what puts the quarter and centre lines exactly on a grid line.
*/
ALTER TABLE `site_settings` ADD `grid_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `grid_columns` integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `grid_snap` integer DEFAULT false NOT NULL;