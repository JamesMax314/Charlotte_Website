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
    /** What she is selling, in her words: "A3 giclée print", "Digital download". */
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
 * Extra pages the artist adds herself, linked from the middle of the top bar.
 *
 * A page is only its identity: the title, the URL and where it sits in the
 * nav. Its content is portfolio items and wall texts carrying `page_id`, so a
 * custom page is composed with exactly the wall the home page uses — and a
 * piece placed on one is a real piece, clickable, with a page of its own.
 */
export const sitePages = sqliteTable(
  "site_pages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    /** Doubles as the nav label and the browser title. */
    title: text("title").notNull(),
    /** Draft keeps it out of the nav and 404s its URL; the artist still sees it. */
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    /** Left to right along the top bar. Set by dragging the links. */
    navOrder: integer("nav_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("site_pages_slug_idx").on(t.slug),
    index("site_pages_nav_idx").on(t.status, t.navOrder),
  ],
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
     * NULL means the home wall. Set means this sits on that custom page's
     * wall. Never set at the same time as `parent_id` — see `WallScope` in
     * src/lib/portfolio.ts, which is the only thing allowed to write the pair.
     */
    pageId: text("page_id").references(() => sitePages.id, { onDelete: "cascade" }),

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
    index("portfolio_items_page_idx").on(t.pageId, t.z),
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
  /**
   * The plain-text mirror of `rich`, kept in step on every write.
   *
   * Not legacy: the wall picks its `<h1>` by comparing text, metadata needs
   * words without marks, and a `rich` column that fails to parse degrades to
   * this rather than to a blank page.
   */
  content: text("content").notNull().default(""),
  /**
   * The rich document, as JSON — see src/lib/rich-text.ts.
   *
   * Null for every row written before rich text existed, which is why
   * `parseDoc` takes the plain mirror as its fallback rather than throwing.
   */
  rich: text("rich"),

  /** NULL means the home wall; set means that piece's own page. */
  parentId: text("parent_id").references(() => portfolioItems.id, { onDelete: "cascade" }),
  /** NULL means the home wall; set means that custom page's wall. */
  pageId: text("page_id").references(() => sitePages.id, { onDelete: "cascade" }),

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
export type SitePageRow = typeof sitePages.$inferSelect;
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
  /** Fade images in as a visitor scrolls. Site only; the editor never fades. */
  contentFadeIn: integer("content_fade_in", { mode: "boolean" }).notNull().default(false),
  etsyShopUrl: text("etsy_shop_url").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),

  /** Identity. The mark is an uploaded raster; empty falls back to the drawn SVG. */
  siteName: text("site_name").notNull().default(""),
  faviconKey: text("favicon_key"),

  /** The one colour the artist controls. Validated as a six-digit hex on write. */
  accentColour: text("accent_colour").notNull().default("#9a5b33"),

  /*
    The top bar's proportions, in pixels. Stored rather than left to Tailwind
    because the artist sets them: the header is the first thing on every page
    and the one piece of chrome that sits against her work on every screen.

    Height is a floor, not a fixed size — see src/lib/header-style.ts for why.
    Defaults are the values the header shipped with (py-5 around a 36px mark,
    text-lg, text-sm), so an existing site looks identical after the migration.
  */
  headerHeight: integer("header_height").notNull().default(76),
  headerNameSize: integer("header_name_size").notNull().default(18),
  headerNavSize: integer("header_nav_size").notNull().default(14),

  /*
    The space between the bar and the page, and between the page and the
    footer — one number, because the artist asked for the two to match and a
    pair of controls could only ever be used to make them disagree.

    Owned by the site layout rather than each page. Before this, every page set
    its own and the footer added a further 96px on top, so the gap above the
    content and the gap below it were never the same number twice.
  */
  contentSpace: integer("content_space").notNull().default(64),

  /*
    The faces the public site is set in. Keys into the font registry
    (src/lib/fonts.ts) rather than an enum, for the same reason as
    `wall_texts.font`: an uploaded font joins the same list with no migration.

    Defaulted to real built-in ids rather than '' so the id always names an
    entry, the admin's select always has something selected, and the resolver
    has no second "unset" state to handle.

    The admin deliberately ignores both — see src/app/(site)/layout.tsx.
  */
  bodyFontId: text("body_font_id").notNull().default("sans"),
  headingFontId: text("heading_font_id").notNull().default("serif"),

  /*
    Copy for the three static pages, as typed into a plain textarea: a blank
    line starts a paragraph. Empty means "she has not written anything yet",
    and the page falls back to the prose it shipped with — see
    src/lib/default-copy.ts for why that is not the reader's job.
  */
  aboutCopy: text("about_copy").notNull().default(""),
  /** Rich versions of the three, with the plain columns above as their mirrors. */
  aboutRich: text("about_rich"),
  contactRich: text("contact_rich"),
  privacyRich: text("privacy_rich"),
  aboutPhotoKey: text("about_photo_key"),
  aboutPhotoAlt: text("about_photo_alt").notNull().default(""),
  /** next/image needs intrinsic dimensions, as every other image table stores them. */
  aboutPhotoWidth: integer("about_photo_width"),
  aboutPhotoHeight: integer("about_photo_height"),
  aboutPhotoLqip: text("about_photo_lqip"),
  contactCopy: text("contact_copy").notNull().default(""),
  privacyCopy: text("privacy_copy").notNull().default(""),
});

/**
 * Fonts the artist has uploaded, offered alongside the built-in faces.
 *
 * Rows rather than a JSON column on site_settings: each font needs a stable id
 * for `wall_texts.font` to point at, and an individual delete.
 */
export const siteFonts = sqliteTable("site_fonts", {
  /** Server-generated and prefixed, so an upload cannot claim a built-in's key. */
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  /** The sanitised CSS family name, without quotes. */
  family: text("family").notNull(),
  storageKey: text("storage_key").notNull(),
  format: text("format", { enum: ["woff2", "woff", "truetype", "opentype"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type ArtworkRow = typeof artworks.$inferSelect;
export type ArtworkImageRow = typeof artworkImages.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
export type SiteFontRow = typeof siteFonts.$inferSelect;

/**
 * A published version of the whole public site.
 *
 * The artist edits the tables above freely; none of it reaches a visitor until
 * she presses "Make live", which serialises everything the public site reads
 * into one row here. Public reads then come from the newest revision, so a
 * half-finished rearrangement is never on show and a set of related changes
 * goes out together rather than one save at a time.
 *
 * A whole snapshot rather than a flag per row because publishing has to be
 * atomic: a flag per row is a write per row, and a dropped connection halfway
 * through would leave the site showing half of one version and half of another.
 *
 * D1 caps a row at 2MB, which is the ceiling on the whole public site — see
 * `SNAPSHOT_LIMIT_BYTES` in src/lib/site-snapshot.ts, which refuses to publish
 * rather than write a row D1 will reject.
 */
export const siteRevisions = sqliteTable(
  "site_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** SHA-256 of the canonicalised snapshot; what the "Live" badge compares. */
    hash: text("hash").notNull(),
    /** The serialised `SiteSnapshot` — see src/lib/site-snapshot.ts. */
    snapshot: text("snapshot").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("site_revisions_published_idx").on(t.publishedAt)],
);

/**
 * R2 objects that a draft has finished with but the live site still needs.
 *
 * Deleting a piece removes its images from the bucket immediately, which was
 * correct while the studio and the site were the same thing. Now the published
 * revision can still reference them, so a delete would knock holes in a live
 * page the artist had not touched. Keys still in the published snapshot are
 * recorded here instead and swept on the next publish.
 */
export const pendingMediaDeletions = sqliteTable("pending_media_deletions", {
  storageKey: text("storage_key").primaryKey(),
});

export type SiteRevisionRow = typeof siteRevisions.$inferSelect;
