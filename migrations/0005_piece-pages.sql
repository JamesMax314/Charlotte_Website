ALTER TABLE `portfolio_items` ADD `parent_id` text REFERENCES portfolio_items(id);--> statement-breakpoint
ALTER TABLE `portfolio_items` ADD `clickable` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `portfolio_items_parent_idx` ON `portfolio_items` (`parent_id`,`z`);--> statement-breakpoint
ALTER TABLE `wall_texts` ADD `parent_id` text REFERENCES portfolio_items(id);--> statement-breakpoint
-- Convert every non-cover image into a child wall element, so pages that were
-- a stacked list become an editable wall without losing anything. Ids derive
-- from the image id, which keeps this idempotent and needs no application code.
INSERT INTO portfolio_items (id, parent_id, slug, name, information, status,
                             x, y, width, z, clickable, created_at, updated_at)
SELECT 'child-' || pi.id, pi.item_id, 'child-' || pi.id, '', '', 'published',
       4, 4 + (pi.sort_order - 1) * 60, 92, pi.sort_order, 0,
       (unixepoch() * 1000), (unixepoch() * 1000)
FROM portfolio_images pi
WHERE pi.sort_order > 0;
--> statement-breakpoint
UPDATE portfolio_images SET item_id = 'child-' || id, sort_order = 0 WHERE sort_order > 0;
