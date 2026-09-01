import "server-only";
import { unstable_rethrow } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "./db";
import { getSiteSource } from "./publish";
import type { SitePage } from "./site-pages";
import type { Timeless } from "./site-snapshot";

/**
 * D1 reads for the artist's custom pages. Pure types and rules live in
 * src/lib/site-pages.ts so client components can use them.
 */

const toPage = (row: Timeless<schema.SitePageRow>): SitePage => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  status: row.status,
  navOrder: row.navOrder,
});

/**
 * The links in the middle of the top bar, left to right.
 *
 * Read by the site header, which every public page renders, so this is on the
 * critical path for the whole site — hence one query with no join. Draft pages
 * are absent: a page the artist is still building must not appear in the nav.
 *
 * The try/catch is here for the same reason `getSiteSettings` has one, and it
 * matters more: a deploy that skipped `db:migrate` finds no `site_pages` table,
 * and an unguarded throw in the header would take down every page on the site
 * rather than the feature that needs it. It degrades to the nav the site had
 * before custom pages existed. The `console.error` is the only signal, so a
 * missing migration looks like an artist's pages quietly vanishing — check the
 * logs before believing the database.
 */
export const getNavPages = async (): Promise<SitePage[]> => {
  try {
    const source = await getSiteSource();
    if (source.kind === "live") {
      return source.snapshot.pages.filter((page) => page.status === "published").map(toPage);
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.sitePages)
      .where(eq(schema.sitePages.status, "published"))
      .orderBy(asc(schema.sitePages.navOrder));
    return rows.map(toPage);
  } catch (cause) {
    // Never swallow Next's own control-flow errors — see the invariant.
    unstable_rethrow(cause);
    console.error("[site] Reading the custom pages failed; the nav will be empty", cause);
    return [];
  }
};

/**
 * Every page, drafts included — the studio's nav bar and its reorder list.
 *
 * Deliberately not guarded like `getNavPages`: the studio should fail loudly
 * at a missing migration rather than show the artist an empty bar and invite
 * her to build the same pages again.
 */
export const getAllSitePages = async (): Promise<SitePage[]> => {
  const db = await getDb();
  const rows = await db.select().from(schema.sitePages).orderBy(asc(schema.sitePages.navOrder));
  return rows.map(toPage);
};

export const getSitePageById = async (id: string): Promise<SitePage | undefined> => {
  const db = await getDb();
  const rows = await db.select().from(schema.sitePages).where(eq(schema.sitePages.id, id)).limit(1);
  return rows.length === 0 ? undefined : toPage(rows[0]);
};

/** Public lookup: a draft page resolves to nothing, exactly as a draft piece does. */
export const getPublishedSitePageBySlug = async (slug: string): Promise<SitePage | undefined> => {
  const source = await getSiteSource();
  if (source.kind === "live") {
    const page = source.snapshot.pages.find((candidate) => candidate.slug === slug);
    return page === undefined || page.status !== "published" ? undefined : toPage(page);
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.sitePages)
    .where(eq(schema.sitePages.slug, slug))
    .limit(1);
  if (rows.length === 0 || rows[0].status !== "published") return undefined;
  return toPage(rows[0]);
};
