CREATE TABLE `wall_texts` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`x` real DEFAULT 4 NOT NULL,
	`y` real DEFAULT 4 NOT NULL,
	`width` real DEFAULT 40 NOT NULL,
	`height` real DEFAULT 10 NOT NULL,
	`z` integer DEFAULT 0 NOT NULL,
	`font_size` real DEFAULT 2.4 NOT NULL,
	`align` text DEFAULT 'left' NOT NULL,
	`bold` integer DEFAULT false NOT NULL,
	`italic` integer DEFAULT false NOT NULL,
	`underline` integer DEFAULT false NOT NULL,
	`colour` text DEFAULT '#101010' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);

--> statement-breakpoint
-- Preserve the fixed heading and introduction as editable text boxes.
INSERT INTO wall_texts (id, content, x, y, width, height, z, font_size, align, bold, italic, underline, colour, created_at, updated_at)
SELECT 'text-migrated-heading', home_title, 2, 2, 46, 12, 1000, 5.2, 'left', 0, 0, 0, '#101010',
       (unixepoch() * 1000), (unixepoch() * 1000)
FROM site_settings WHERE id = 1 AND trim(home_title) != '';
--> statement-breakpoint
INSERT INTO wall_texts (id, content, x, y, width, height, z, font_size, align, bold, italic, underline, colour, created_at, updated_at)
SELECT 'text-migrated-blurb', home_blurb, 54, 3, 38, 12, 1001, 1.6, 'left', 0, 0, 0, '#6d6a66',
       (unixepoch() * 1000), (unixepoch() * 1000)
FROM site_settings WHERE id = 1 AND trim(home_blurb) != '';
