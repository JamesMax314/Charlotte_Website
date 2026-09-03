import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "@/db/schema";

/**
 * Rows a delete kept, so undo can put them back.
 *
 * The studio's deletes are undoable, which means the rows have to survive the
 * delete somewhere. They survive in the browser: the delete action reads what
 * it is about to remove, returns it, and the undo entry hands it back. Nothing
 * is written to the database to make this work — no tombstone column, no
 * deleted-at, no second copy of the catalogue — because the history lives for
 * as long as the artist is on one page and a durable record of it would
 * outlive the thing it describes by years.
 *
 * That does mean the round trip is: server → client → server. So the way back
 * in is a public endpoint carrying rows the browser could have written, and
 * this module is the part that refuses to trust them. Every table is on an
 * allowlist, every column is coerced against the type the schema declares, and
 * anything unrecognised is rejected rather than guessed at — the same rule
 * `sanitiseDoc` applies to a rich document arriving from the editor.
 *
 * The coercion is generated from the Drizzle table rather than hand-written,
 * which is the whole reason it can be trusted to stay right: a column added to
 * `src/db/schema.ts` is understood here on the same commit, and there is no
 * second list to forget to update.
 */

/**
 * The tables a delete can be undone into, in an order that satisfies the
 * foreign keys.
 *
 * Insert order is not cosmetic. `db.batch` runs inside a transaction, and
 * SQLite checks a foreign key as each row lands rather than at the end, so a
 * `portfolio_images` row inserted before the piece it belongs to fails the
 * whole restore. Pages and artworks come first because everything else points
 * at them; the leaves come last.
 */
export const RESTORABLE = {
  site_pages: schema.sitePages,
  artworks: schema.artworks,
  portfolio_items: schema.portfolioItems,
  portfolio_images: schema.portfolioImages,
  wall_texts: schema.wallTexts,
  artwork_images: schema.artworkImages,
  listings: schema.listings,
  site_fonts: schema.siteFonts,
} as const satisfies Record<string, SQLiteTable>;

export type RestorableTable = keyof typeof RESTORABLE;

/** `Object.keys` on a literal loses the key type; this is the same list, typed. */
export const RESTORE_ORDER = Object.keys(RESTORABLE) as RestorableTable[];

/** What a delete returns and an undo hands back. Keyed by table, so merging is a spread. */
export type Backup = {
  [T in RestorableTable]?: Record<string, unknown>[];
};

/** Concatenates per table, for a delete that spans several of them. */
export const mergeBackups = (...parts: Backup[]): Backup => {
  const merged: Backup = {};
  for (const part of parts) {
    for (const table of RESTORE_ORDER) {
      const rows = part[table];
      if (rows === undefined || rows.length === 0) continue;
      merged[table] = [...(merged[table] ?? []), ...rows];
    }
  }
  return merged;
};

export const isEmptyBackup = (backup: Backup): boolean =>
  RESTORE_ORDER.every((table) => (backup[table]?.length ?? 0) === 0);

const fail = (table: string, column: string, why: string): never => {
  throw new Error(`Cannot restore ${table}.${column}: ${why}`);
};

/**
 * Coerces one value to the type its column declares, or refuses.
 *
 * Refuses rather than dropping the column. A dropped `notNull` column would
 * take the schema default instead — so a restored piece could come back
 * published when it was a draft, or at x=0 when it was halfway across the
 * wall, and nothing anywhere would report it.
 */
const coerceValue = (
  table: string,
  key: string,
  value: unknown,
  column: { dataType: string; notNull: boolean; enumValues?: string[] | undefined },
): unknown => {
  if (value === null || value === undefined) {
    return column.notNull ? fail(table, key, "required, but the backup has no value") : null;
  }

  switch (column.dataType) {
    case "string": {
      if (typeof value !== "string") return fail(table, key, "expected a string");
      // An enum column is the site's own vocabulary — status, availability,
      // alignment. A value off the list would be readable by nothing.
      if (column.enumValues !== undefined && column.enumValues.length > 0) {
        if (!column.enumValues.includes(value))
          return fail(table, key, `"${value}" is not allowed`);
      }
      return value;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return fail(table, key, "expected a finite number");
      }
      return value;
    }
    case "boolean": {
      if (typeof value !== "boolean") return fail(table, key, "expected a boolean");
      return value;
    }
    case "date": {
      /*
        A Date survives the trip out to the browser and back — React's
        serialisation carries it — but a number does too, and a timestamp_ms
        column is read back from D1 as one of them depending on the path. Both
        are accepted; anything that does not parse is not a date.
      */
      const date = value instanceof Date ? value : new Date(value as string | number);
      if (Number.isNaN(date.getTime())) return fail(table, key, "expected a date");
      return date;
    }
    default:
      return fail(table, key, `unsupported column type "${column.dataType}"`);
  }
};

/**
 * Rebuilds one table's rows from the backup, keeping only declared columns.
 *
 * Unknown keys are dropped in silence rather than refused: they are what a
 * backup taken before a column was removed looks like, and that is a history
 * from earlier in the same session, not an attack. Unknown *tables* are a
 * different matter and are refused by `RESTORABLE` above.
 */
export const coerceRows = (
  table: RestorableTable,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] => {
  const columns = getTableColumns(RESTORABLE[table]);

  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(columns)) {
      clean[key] = coerceValue(table, key, row[key], column);
    }
    return clean;
  });
};

/**
 * Parents before children, for the one table that references itself.
 *
 * `portfolio_items.parent_id` points at another row in its own table, so
 * restoring a piece together with the elements on its page can violate the
 * foreign key on row order alone. Everything else is already ordered by
 * `RESTORE_ORDER`; this is the case that order cannot express.
 */
export const parentsFirst = (rows: Record<string, unknown>[]): Record<string, unknown>[] => [
  ...rows.filter((row) => row.parentId === null || row.parentId === undefined),
  ...rows.filter((row) => row.parentId !== null && row.parentId !== undefined),
];

/**
 * Every R2 key the backup brings back into use.
 *
 * A restore is the other half of `releaseMedia`: the delete queued these keys
 * for removal, and putting the rows back means the site references them again.
 * Without `claimMedia` on exactly this list, the next publish sweeps the
 * bucket out from under a piece the artist has just recovered.
 */
export const backupMediaKeys = (backup: Backup): string[] => {
  const keys: string[] = [];
  for (const table of RESTORE_ORDER) {
    for (const row of backup[table] ?? []) {
      const key = row.storageKey;
      if (typeof key === "string" && key !== "") keys.push(key);
    }
  }
  return [...new Set(keys)];
};
