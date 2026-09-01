/**
 * Custom pages: the ones the artist adds herself, linked from the middle of
 * the top bar.
 *
 * Types and pure rules only. As with portfolio.ts, the admin nav bar is a
 * client component and imports from here, so any database access would break
 * the build. Queries live in src/lib/site-pages-queries.ts.
 */

export interface SitePage {
  id: string;
  slug: string;
  /** The nav label and the browser title, in one field. */
  title: string;
  status: "draft" | "published";
  navOrder: number;
}

/**
 * Slugs a custom page may not take.
 *
 * Custom pages live at the top level — `/exhibitions`, not `/pages/exhibitions`
 * — because that is the link the artist would write on a card. Next resolves a
 * static segment before a dynamic one, so a page slugged `about` would not
 * break `/about`; it would simply never be reachable, and there would be
 * nothing on screen to explain why. Rejecting the name at the point she types
 * it is the only version of this she can act on.
 *
 * `media`, `api` and `_next` are not reachable through this route at all, but
 * a page named after one is still a trap worth closing.
 */
export const RESERVED_PAGE_SLUGS = new Set([
  "about",
  "admin",
  "api",
  "contact",
  "favicon.ico",
  "icon",
  "media",
  "opengraph-image",
  "privacy",
  "robots.txt",
  "shop",
  "sitemap.xml",
  "work",
  "_next",
]);

export const isReservedPageSlug = (slug: string): boolean =>
  RESERVED_PAGE_SLUGS.has(slug.trim().toLowerCase());

/** The label a page shows in the nav before the artist has titled it. */
export const UNTITLED_PAGE_TITLE = "New page";

/**
 * The nav label for a page.
 *
 * A page with no title still has to be clickable in the studio, or the artist
 * cannot reach the editor to give it one.
 */
export const navLabel = (page: SitePage): string => page.title.trim() || UNTITLED_PAGE_TITLE;
