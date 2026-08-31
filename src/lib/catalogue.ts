import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { asc, eq, inArray, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Artwork, ArtworkImage, Listing } from "./artworks";

/**
 * D1-backed catalogue reads.
 *
 * These were seeded arrays in Phase 1 and the signatures were already async, so
 * swapping in real queries touched no component.
 */
export const getDb = async () => {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
};

const toImage = (row: schema.ArtworkImageRow): ArtworkImage => ({
  id: row.id,
  src: `/media/${row.storageKey}`,
  alt: row.alt,
  width: row.width,
  height: row.height,
  lqip: row.lqip,
});

const toListing = (row: schema.ListingRow): Listing => ({
  id: row.id,
  kind: row.kind,
  label: row.label,
  etsyUrl: row.etsyUrl,
  pricePence: row.pricePence,
  availability: row.availability,
  editionSize: row.editionSize,
  editionRemaining: row.editionRemaining,
});

/** Loads children for a set of artworks in two queries rather than N. */
async function hydrate(rows: schema.ArtworkRow[]): Promise<Artwork[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);

  const [images, listingRows] = await Promise.all([
    db
      .select()
      .from(schema.artworkImages)
      .where(inArray(schema.artworkImages.artworkId, ids))
      .orderBy(asc(schema.artworkImages.sortOrder)),
    db
      .select()
      .from(schema.listings)
      .where(inArray(schema.listings.artworkId, ids))
      .orderBy(asc(schema.listings.sortOrder)),
  ]);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    year: row.year,
    medium: row.medium,
    dimensionsNote: row.dimensionsNote,
    description: row.description,
    status: row.status,
    sortOrder: row.sortOrder,
    isFeatured: row.isFeatured,
    images: images.filter((i) => i.artworkId === row.id).map(toImage),
    listings: listingRows.filter((l) => l.artworkId === row.id).map(toListing),
  }));
}

export const getPublishedArtworks = async (): Promise<Artwork[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.artworks)
    .where(eq(schema.artworks.status, "published"))
    .orderBy(asc(schema.artworks.sortOrder));
  return hydrate(rows);
};

export const getFeaturedArtworks = async (): Promise<Artwork[]> =>
  (await getPublishedArtworks()).filter((a) => a.isFeatured);

/** Published and archived resolve; drafts do not. */
export const getArtworkBySlug = async (slug: string): Promise<Artwork | undefined> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.artworks)
    .where(eq(schema.artworks.slug, slug))
    .limit(1);
  if (rows.length === 0 || rows[0].status === "draft") return undefined;
  return (await hydrate(rows))[0];
};

/** Every slug that should be prerendered and appear in the sitemap. */
export const getRoutableSlugs = async (): Promise<string[]> => {
  const db = await getDb();
  const rows = await db
    .select({ slug: schema.artworks.slug })
    .from(schema.artworks)
    .where(ne(schema.artworks.status, "draft"))
    .orderBy(asc(schema.artworks.sortOrder));
  return rows.map((r) => r.slug);
};

/** Admin needs everything, drafts included. */
export const getAllArtworks = async (): Promise<Artwork[]> => {
  const db = await getDb();
  const rows = await db.select().from(schema.artworks).orderBy(asc(schema.artworks.sortOrder));
  return hydrate(rows);
};

export const getArtworkById = async (id: string): Promise<Artwork | undefined> => {
  const db = await getDb();
  const rows = await db.select().from(schema.artworks).where(eq(schema.artworks.id, id)).limit(1);
  return rows.length === 0 ? undefined : (await hydrate(rows))[0];
};

const SETTINGS_FALLBACK = {
  heroArtworkId: null as string | null,
  announcement: null as string | null,
  // Superseded by wall_texts: the heading and introduction are now free text
  // boxes on the wall. Kept so existing rows still read, and because the
  // migration copied these values into text boxes rather than discarding them.
  homeTitle: "Drawn to explain.",
  homeBlurb:
    "I make illustrated maps, editorial spreads and sequences — drawings that carry information as well as atmosphere.",
  gutterEnabled: false,
  gutter: 2,
  snapEnabled: true,
  showNamesOnHover: true,
  etsyShopUrl: "https://www.etsy.com/",
  contactEmail: "hello@example.com",
  instagramUrl: "https://www.instagram.com/",
};

/**
 * Site settings, with a safe fallback.
 *
 * The root layout reads these, so every page depends on them. If the D1 binding
 * is unavailable — a build machine, CI — degrade to defaults rather than failing
 * the build. Pages that must show live settings are marked force-dynamic.
 */
export const getSiteSettings = async () => {
  try {
    const db = await getDb();
    const rows = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.id, 1));
    return rows.length === 0 ? SETTINGS_FALLBACK : { ...SETTINGS_FALLBACK, ...rows[0] };
  } catch {
    return SETTINGS_FALLBACK;
  }
};
