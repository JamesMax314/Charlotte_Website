import "server-only";
import { inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "./db";

/**
 * Deleting a piece, and everything arranged on its own page with it.
 *
 * This exists because the database does not cascade `parent_id`, however much
 * src/db/schema.ts says it does — see the invariant in docs/progress.md. Every
 * delete path goes through here rather than trusting D1 to do it, because the
 * failure when it does not is a hard `FOREIGN KEY constraint failed` that
 * reaches the artist as an unreadable minified React error.
 *
 * It lives in its own module because both callers are `"use server"` files,
 * where every export is a server action — a helper exported from one of those
 * would be published as an endpoint of its own.
 */

/**
 * Removes pieces along with the elements on their pages.
 *
 * One level down is the whole tree. A piece is only inert — and so only owns a
 * page's worth of elements — when it has no `parent_id` of its own, so a child
 * can never itself be a parent. `isInteractive` in src/lib/portfolio.ts is
 * where that rule is enforced.
 *
 * The three statements are one `db.batch`, so a piece and its page's contents
 * go together or not at all. Half of this applied leaves elements pointing at
 * a row that no longer exists: invisible, because every wall read is scoped by
 * a `parent_id` that now matches nothing, and unreachable by the artist, who
 * has no surface on which to find them again.
 *
 * Images look after themselves — `portfolio_images.item_id` does carry
 * `ON DELETE CASCADE` in the database, and did all along. Only the two
 * `parent_id` columns were missing it. R2 objects are a separate matter and
 * are swept by `releaseMedia` before any of this runs.
 */
export const deletePiecesWithPages = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;

  const db = await getDb();
  await db.batch([
    db.delete(schema.wallTexts).where(inArray(schema.wallTexts.parentId, ids)),
    db.delete(schema.portfolioItems).where(inArray(schema.portfolioItems.parentId, ids)),
    db.delete(schema.portfolioItems).where(inArray(schema.portfolioItems.id, ids)),
  ]);
};
