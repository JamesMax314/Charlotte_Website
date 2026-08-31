import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * The catalogue, in D1. Shapes follow docs/project-brief.md §6.
 *
 * Money is integer pence everywhere. Timestamps are epoch milliseconds, which
 * SQLite stores as plain integers and Drizzle maps to Date.
 */

export const artworks = sqliteTable(
  "artworks",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    year: integer("year").notNull(),
    medium: text("medium").notNull().default(""),
    dimensionsNote: text("dimensions_note"),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("artworks_slug_idx").on(t.slug),
    index("artworks_status_sort_idx").on(t.status, t.sortOrder),
  ],
);

export const artworkImages = sqliteTable(
  "artwork_images",
  {
    id: text("id").primaryKey(),
    artworkId: text("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    /** R2 object key. Never a public URL — images are served through /media. */
    storageKey: text("storage_key").notNull(),
    alt: text("alt").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** Tiny base64 JPEG placeholder, generated in the browser at upload time. */
    lqip: text("lqip"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("artwork_images_artwork_idx").on(t.artworkId, t.sortOrder)],
);

export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    artworkId: text("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["print", "digital"] }).notNull(),
    label: text("label").notNull(),
    etsyUrl: text("etsy_url").notNull(),
    /** Indicative only. Etsy is the source of truth (brief P-05). */
    pricePence: integer("price_pence").notNull(),
    availability: text("availability", { enum: ["available", "sold_out"] })
      .notNull()
      .default("available"),
    editionSize: integer("edition_size"),
    editionRemaining: integer("edition_remaining"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("listings_artwork_idx").on(t.artworkId, t.sortOrder)],
);

/** Single row, id = 1. */
export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey(),
  heroArtworkId: text("hero_artwork_id"),
  announcement: text("announcement"),
  etsyShopUrl: text("etsy_shop_url").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
});

export type ArtworkRow = typeof artworks.$inferSelect;
export type ArtworkImageRow = typeof artworkImages.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
