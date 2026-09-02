import type {
  ArtworkImageRow,
  ArtworkRow,
  ListingRow,
  PortfolioImageRow,
  PortfolioItemRow,
  SiteFontRow,
  SitePageRow,
  SiteSettingsRow,
  WallTextRow,
} from "@/db/schema";

/**
 * The published site, as data.
 *
 * Pure and binding-free, like src/lib/storage.ts and for the same reason: the
 * hash decides whether the artist sees "Live" or "Make live", so the rule that
 * produces it has to be testable without a database. `crypto.subtle` exists in
 * both Workers and Node, so even the digest runs under Vitest.
 */

/** Bumped when the shape changes incompatibly; an older revision is ignored. */
export const SNAPSHOT_VERSION = 1;

/**
 * D1 refuses a row over 2MB. Publishing is the one write that can approach it,
 * so it is checked rather than discovered — a rejected write at this size
 * surfaces as a D1 error with no clue which of the artist's uploads caused it.
 * The margin covers the rest of the row and the JSON escaping.
 */
export const SNAPSHOT_LIMIT_BYTES = 1_800_000;

/**
 * Timestamps are dropped on the way in.
 *
 * Nothing public reads `createdAt` or `updatedAt` — every mapper in the query
 * modules ignores them — and keeping them would put a value that changes on
 * every save into the hash, so the badge would report changes to publish after
 * a save that altered nothing a visitor can see. They also do not survive
 * JSON: `timestamp_ms` gives a Date going in and a string coming back.
 */
export type Timeless<T> = Omit<T, "createdAt" | "updatedAt">;

export type SiteSnapshot = {
  version: number;
  settings: Timeless<SiteSettingsRow> | null;
  fonts: Timeless<SiteFontRow>[];
  pages: Timeless<SitePageRow>[];
  items: Timeless<PortfolioItemRow>[];
  itemImages: PortfolioImageRow[];
  texts: Timeless<WallTextRow>[];
  artworks: Timeless<ArtworkRow>[];
  artworkImages: ArtworkImageRow[];
  listings: ListingRow[];
};

/**
 * Strips the two timestamp columns from a set of rows.
 *
 * A helper rather than an explicit column projection per table: a projection
 * has to be edited every time a column is added, and the failure when it is
 * forgotten is a column that silently never publishes.
 */
export const timeless = <T extends object>(rows: T[]): Timeless<T>[] =>
  rows.map((row) => {
    const copy = { ...row } as Record<string, unknown>;
    delete copy.createdAt;
    delete copy.updatedAt;
    return copy as Timeless<T>;
  });

/**
 * Sorts object keys throughout, so the hash describes the content and not the
 * order a query happened to return its columns in.
 *
 * Without it the digest changes whenever a `select` projection or the schema's
 * column order is edited, and the artist is told her site has unpublished
 * changes by a deploy that changed no content at all.
 */
export const canonicalise = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value === null || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) sorted[key] = canonicalise(source[key]);
  return sorted;
};

export const serialiseSnapshot = (snapshot: SiteSnapshot): string =>
  JSON.stringify(canonicalise(snapshot));

/** SHA-256 of the canonical form, as hex. Equal hashes mean an identical site. */
export const hashSnapshot = async (snapshot: SiteSnapshot): Promise<string> => {
  const bytes = new TextEncoder().encode(serialiseSnapshot(snapshot));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Reads a stored revision back, refusing anything it does not recognise.
 *
 * Returns null rather than throwing: a snapshot that cannot be read must fall
 * through to the draft tables, which is the site the artist last saved, rather
 * than take every public page down.
 */
export const parseSnapshot = (json: string): SiteSnapshot | null => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object") return null;
    const snapshot = parsed as SiteSnapshot;
    if (snapshot.version !== SNAPSHOT_VERSION) return null;
    const lists = [
      snapshot.fonts,
      snapshot.pages,
      snapshot.items,
      snapshot.itemImages,
      snapshot.texts,
      snapshot.artworks,
      snapshot.artworkImages,
      snapshot.listings,
    ];
    if (lists.some((list) => !Array.isArray(list))) return null;
    return snapshot;
  } catch (cause) {
    console.error("[publish] the published revision could not be read", cause);
    return null;
  }
};

/**
 * Every R2 object the published site depends on.
 *
 * Base keys only — the width-ladder derivatives are named after them, so
 * `derivativeKeys` reconstructs those at the point of deletion.
 */
export const snapshotMediaKeys = (snapshot: SiteSnapshot): Set<string> => {
  const keys = new Set<string>();
  for (const image of snapshot.itemImages) keys.add(image.storageKey);
  for (const image of snapshot.artworkImages) keys.add(image.storageKey);
  for (const font of snapshot.fonts) keys.add(font.storageKey);
  if (snapshot.settings?.faviconKey) keys.add(snapshot.settings.faviconKey);
  if (snapshot.settings?.aboutPhotoKey) keys.add(snapshot.settings.aboutPhotoKey);
  if (snapshot.settings?.shareImageKey) keys.add(snapshot.settings.shareImageKey);
  return keys;
};
