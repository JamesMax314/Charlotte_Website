import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { asc, eq, inArray, ne } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DEFAULT_ACCENT } from "./colour";
import { DEFAULT_FONT_ID, DISPLAY_FONT_ID } from "./fonts";
import {
  DEFAULT_ABOUT_COPY,
  DEFAULT_CONTACT_COPY,
  DEFAULT_PRIVACY_COPY,
  DEFAULT_SITE_NAME,
} from "./default-copy";
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
  contentFadeIn: false,
  etsyShopUrl: "https://www.etsy.com/",
  contactEmail: "hello@example.com",
  instagramUrl: "https://www.instagram.com/",
  siteName: DEFAULT_SITE_NAME,
  faviconKey: null as string | null,
  accentColour: DEFAULT_ACCENT,
  bodyFontId: DEFAULT_FONT_ID,
  headingFontId: DISPLAY_FONT_ID,
  // Only reached when D1 is unavailable. A stored empty string spreads *over*
  // these, so the pages fall back themselves — see src/lib/default-copy.ts.
  aboutCopy: DEFAULT_ABOUT_COPY,
  aboutPhotoKey: null as string | null,
  aboutPhotoAlt: "",
  aboutPhotoWidth: null as number | null,
  aboutPhotoHeight: null as number | null,
  aboutPhotoLqip: null as string | null,
  contactCopy: DEFAULT_CONTACT_COPY,
  privacyCopy: DEFAULT_PRIVACY_COPY,
};

/**
 * Site settings, with a safe fallback.
 *
 * The root layout reads these — for the site name, the favicon and the
 * highlight colour — so every page depends on them, the admin included. If the
 * D1 binding is unavailable, degrade to defaults rather than failing: on a
 * build machine that is what lets CI build at all, and in production it is what
 * keeps /admin/login reachable when the database is broken. Do not turn this
 * catch into a throw.
 *
 * It does mean a missed migration is invisible — the site renders perfectly at
 * every default while silently ignoring the artist's settings — so the failure
 * is logged. That log line is the only signal there is.
 *
 * Memoised per request because the header, the footer and the page each ask
 * independently; without this the home page ran the same query three times.
 */
export const getSiteSettings = cache(async () => {
  try {
    const db = await getDb();
    const rows = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.id, 1));
    return rows.length === 0 ? SETTINGS_FALLBACK : { ...SETTINGS_FALLBACK, ...rows[0] };
  } catch (cause) {
    console.error("[settings] falling back to defaults", cause);
    return SETTINGS_FALLBACK;
  }
});
