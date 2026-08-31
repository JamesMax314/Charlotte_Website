import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

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

/**
 * The portfolio — what the home page shows.
 *
 * Deliberately separate from `artworks`, which is the store. Portfolio pieces
 * carry no price: they exist to be looked at, not bought. A piece may hold
 * several images because it can represent a whole project.
 */
export const portfolioItems = sqliteTable(
  "portfolio_items",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    /** May be blank: an untitled piece shows nothing on hover (see brief). */
    name: text("name").notNull(),
    information: text("information").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("published"),

    /**
     * NULL means the home wall. Set means this is an element on that piece's
     * own page — inert, never linked, never in the sitemap.
     */
    parentId: text("parent_id").references((): AnySQLiteColumn => portfolioItems.id, {
      onDelete: "cascade",
    }),

    /**
     * Interactive on the site, and has a page of its own. Defaults true so
     * every piece that existed before this column keeps behaving as it did.
     */
    clickable: integer("clickable", { mode: "boolean" }).notNull().default(true),

    /**
     * Free-form placement on the home wall.
     *
     * All three are percentages of the canvas WIDTH, including `y` — using one
     * axis for every unit is what makes the arrangement scale proportionally at
     * any viewport width instead of distorting. Height is derived from the
     * cover image's natural aspect ratio, so resizing can never squash artwork.
     */
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    width: real("width").notNull().default(30),
    z: integer("z").notNull().default(0),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("portfolio_items_slug_idx").on(t.slug),
    index("portfolio_items_status_idx").on(t.status),
    index("portfolio_items_parent_idx").on(t.parentId, t.z),
  ],
);

export const portfolioImages = sqliteTable(
  "portfolio_images",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => portfolioItems.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    alt: text("alt").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    lqip: text("lqip"),
    /** The first image is the cover shown on the home wall. */
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("portfolio_images_item_idx").on(t.itemId, t.sortOrder)],
);

/**
 * Free-floating text on the home wall.
 *
 * Positioned with the same units as portfolio pieces — percentages of canvas
 * width — so text and artwork scale together. Unlike a piece, a text box has an
 * explicit height: there is no aspect ratio to derive one from, and the artist
 * resizes it in both directions.
 *
 * `fontSize` is also a percentage of canvas width, which is what keeps type in
 * proportion as the wall scales.
 */
export const wallTexts = sqliteTable("wall_texts", {
  id: text("id").primaryKey(),
  content: text("content").notNull().default(""),

  /** NULL means the home wall; set means that piece's own page. */
  parentId: text("parent_id").references(() => portfolioItems.id, { onDelete: "cascade" }),

  x: real("x").notNull().default(4),
  y: real("y").notNull().default(4),
  width: real("width").notNull().default(40),
  height: real("height").notNull().default(10),
  z: integer("z").notNull().default(0),

  fontSize: real("font_size").notNull().default(2.4),
  align: text("align", { enum: ["left", "center", "right"] })
    .notNull()
    .default("left"),
  bold: integer("bold", { mode: "boolean" }).notNull().default(false),
  italic: integer("italic", { mode: "boolean" }).notNull().default(false),
  underline: integer("underline", { mode: "boolean" }).notNull().default(false),
  colour: text("colour").notNull().default("#101010"),
  /**
   * A key into the font registry (src/lib/fonts.ts), not an enum: the artist
   * will be able to upload her own fonts, and an enum would need a schema
   * migration for each one.
   */
  font: text("font").notNull().default("sans"),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type WallTextRow = typeof wallTexts.$inferSelect;
export type PortfolioItemRow = typeof portfolioItems.$inferSelect;
export type PortfolioImageRow = typeof portfolioImages.$inferSelect;

/** Single row, id = 1. */
export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey(),
  heroArtworkId: text("hero_artwork_id"),
  announcement: text("announcement"),
  /** Home page copy, editable by the artist. */
  homeTitle: text("home_title").notNull().default(""),
  homeBlurb: text("home_blurb").notNull().default(""),

  /**
   * How the wall behaves. Percentages of canvas width, like every other
   * portfolio measurement.
   */
  gutterEnabled: integer("gutter_enabled", { mode: "boolean" }).notNull().default(false),
  gutter: real("gutter").notNull().default(2),
  snapEnabled: integer("snap_enabled", { mode: "boolean" }).notNull().default(true),
  showNamesOnHover: integer("show_names_on_hover", { mode: "boolean" }).notNull().default(true),
  etsyShopUrl: text("etsy_shop_url").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
});

export type ArtworkRow = typeof artworks.$inferSelect;
export type ArtworkImageRow = typeof artworkImages.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
