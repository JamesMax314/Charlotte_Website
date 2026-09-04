import "server-only";
import { eq, getTableColumns, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "@/db/schema";
import { getDb } from "./db";
import { chunk, maxRowsPerInsert } from "./chunk";
import { claimMedia } from "./publish";
import {
  backupMediaKeys,
  coerceRows,
  isEmptyBackup,
  mergeBackups,
  parentsFirst,
  RESTORABLE,
  RESTORE_ORDER,
  type Backup,
} from "./undo-backup";

/**
 * Reading rows before a delete removes them, and putting them back.
 *
 * The capture half runs inside the delete rather than as a call of its own,
 * which is what keeps it correct as well as cheap: a separate "capture then
 * delete" is two round trips with a gap in the middle, and on the free tier's
 * CPU budget the round trips matter almost as much as the gap does.
 *
 * Its own module because `src/lib/undo-backup.ts` must stay free of the
 * database — it is pure and unit-tested — and because every caller here is a
 * `"use server"` file, where a helper exported alongside the actions would be
 * published as an endpoint of its own. The same reasoning that put
 * `deletePiecesWithPages` in `portfolio-deletes.ts`.
 */

/** Every column, as an object, which is what the backup format wants. */
const rowsOf = async <T extends keyof typeof RESTORABLE>(
  table: T,
  ids: string[],
  column: Parameters<typeof inArray>[0],
): Promise<Record<string, unknown>[]> => {
  if (ids.length === 0) return [];
  const db = await getDb();
  return (await db.select().from(RESTORABLE[table]).where(inArray(column, ids))) as Record<
    string,
    unknown
  >[];
};

/**
 * A piece, its photographs, and everything arranged on its own page.
 *
 * The same family `deletePortfolioItem` collects, for the same reason: one
 * level down is the whole tree, because a piece only owns a page when it has
 * no `parent_id` of its own. Capturing less than the delete removes would give
 * the artist back a piece with an empty page and no sign anything was missing.
 */
export const capturePieces = async (ids: string[]): Promise<Backup> => {
  if (ids.length === 0) return {};
  const db = await getDb();

  const children = await db
    .select({ id: schema.portfolioItems.id })
    .from(schema.portfolioItems)
    .where(inArray(schema.portfolioItems.parentId, ids));
  const family = [...ids, ...children.map((child) => child.id)];

  return {
    portfolio_items: await rowsOf("portfolio_items", family, schema.portfolioItems.id),
    portfolio_images: await rowsOf("portfolio_images", family, schema.portfolioImages.itemId),
    wall_texts: await rowsOf("wall_texts", ids, schema.wallTexts.parentId),
  };
};

export const captureWallTexts = async (ids: string[]): Promise<Backup> => ({
  wall_texts: await rowsOf("wall_texts", ids, schema.wallTexts.id),
});

export const capturePortfolioImages = async (ids: string[]): Promise<Backup> => ({
  portfolio_images: await rowsOf("portfolio_images", ids, schema.portfolioImages.id),
});

export const captureArtworkImages = async (ids: string[]): Promise<Backup> => ({
  artwork_images: await rowsOf("artwork_images", ids, schema.artworkImages.id),
});

export const captureSiteFonts = async (ids: string[]): Promise<Backup> => ({
  site_fonts: await rowsOf("site_fonts", ids, schema.siteFonts.id),
});

/** An artwork with its photographs and its Etsy listing. */
export const captureArtworks = async (ids: string[]): Promise<Backup> => ({
  artworks: await rowsOf("artworks", ids, schema.artworks.id),
  artwork_images: await rowsOf("artwork_images", ids, schema.artworkImages.artworkId),
  listings: await rowsOf("listings", ids, schema.listings.artworkId),
});

/**
 * A custom page and the whole wall the artist built on it.
 *
 * A piece on the page may own a page of its own, so `capturePieces` is what
 * collects the second level — the page's own cascade reaches its direct
 * children and no further, exactly as `deleteSitePage` has to.
 */
export const captureSitePage = async (id: string): Promise<Backup> => {
  const db = await getDb();

  const onPage = await db
    .select({ id: schema.portfolioItems.id })
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.pageId, id));

  return mergeBackups(
    { site_pages: await rowsOf("site_pages", [id], schema.sitePages.id) },
    await capturePieces(onPage.map((item) => item.id)),
    { wall_texts: await rowsOf("wall_texts", [id], schema.wallTexts.pageId) },
  );
};

/**
 * Puts a captured backup back.
 *
 * One `db.batch`, which is the rule every group write in this codebase
 * follows: a restore is a set of related changes, and half of one applied
 * leaves an arrangement the artist cannot see the shape of — a piece with some
 * of its photographs, a page missing half its wall.
 *
 * `claimMedia` runs first and deliberately. `releaseMedia` queued these keys
 * when the delete ran, and a restore is the moment they come back into use; if
 * the batch then fails, a key wrongly left out of the queue costs a stale
 * object in the bucket, while a key wrongly still in it costs the artist her
 * photographs at the next publish. The cheap failure is the one to choose.
 */
export const restoreBackup = async (backup: Backup): Promise<void> => {
  if (isEmptyBackup(backup)) return;

  const db = await getDb();
  await claimMedia(backupMediaKeys(backup));

  const statements: BatchItem<"sqlite">[] = [];
  for (const table of RESTORE_ORDER) {
    const raw = backup[table];
    if (raw === undefined || raw.length === 0) continue;

    const rows = coerceRows(table, raw);
    /*
      `onConflictDoNothing` rather than a plain insert. Redo re-runs the delete
      and undo re-runs this, so a double press — or a restore racing an
      autosave that recreated a row — should settle rather than throw. The row
      that is already there is the row this would have written: ids are carried
      in the backup, so there is no version of this that writes a duplicate.
    */
    const ordered = table === "portfolio_items" ? parentsFirst(rows) : rows;
    /*
      Drizzle types `values()` against one specific table, and `table` here is
      a variable ranging over eight of them — so there is no way to state that
      the rows and the table agree. `coerceRows` is what makes it true, at
      runtime, against the very schema those types are derived from.
    */
    const rowsPerInsert = maxRowsPerInsert(Object.keys(getTableColumns(RESTORABLE[table])).length);
    /*
      Chunked rather than one `.values()` per table. D1 caps a statement at
      100 bound parameters and plain SQLite does not, so a restore that put
      everything for one table in a single insert worked in every local test
      and against a wide `portfolio_items`/`wall_texts` family — the exact
      shape a piece with its own page produces — would not in production.
      `parentsFirst` already ordered `ordered` so a parent's chunk is pushed,
      and therefore committed, before its child's; slicing preserves that
      order, and `db.batch` still commits every chunk as one transaction.
    */
    for (const group of chunk(ordered, rowsPerInsert)) {
      statements.push(
        db
          .insert(RESTORABLE[table])
          .values(group as never)
          .onConflictDoNothing(),
      );
    }
  }

  if (statements.length === 0) return;
  // `batch` is typed as a non-empty tuple; the guard above is what makes that
  // true, and there is no way to express it to TypeScript.
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
};
