import "server-only";
import { and, asc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "./db";
import { mergeFonts, type FontOption } from "./fonts";
import { parseDoc } from "./rich-text";
import { getSiteFonts } from "./site-settings";
import { getSiteSource } from "./publish";
import type { Timeless } from "./site-snapshot";
import {
  HOME_WALL,
  isOnWall,
  type PortfolioImage,
  type PortfolioItem,
  type WallScope,
  type WallText,
} from "./portfolio";

/**
 * D1 reads for the portfolio. Pure types and layout maths live in
 * src/lib/portfolio.ts so client components can use them.
 */

/**
 * The clause that puts a read on one wall, and the only one there is.
 *
 * Both content tables carry `parent_id` and `page_id`, and the home wall is
 * the pair of nulls — so a read that filters on one column and forgets the
 * other does not fail, it quietly leaks a custom page's work onto the home
 * page. Every query below goes through here, as does the one write that
 * touches a whole wall at once — see `makeRoomAtTop` in the portfolio actions.
 * Nothing hand-rolls the pair.
 *
 * Reading from a published revision needs the same rule against objects rather
 * than SQL, which is `isOnWall` in src/lib/portfolio.ts.
 */
export const onWall = (
  table: typeof schema.portfolioItems | typeof schema.wallTexts,
  scope: WallScope,
): SQL | undefined => {
  if (scope.kind === "piece") return eq(table.parentId, scope.id);
  return and(
    isNull(table.parentId),
    scope.kind === "page" ? eq(table.pageId, scope.id) : isNull(table.pageId),
  );
};

const toImage = (row: schema.PortfolioImageRow): PortfolioImage => ({
  id: row.id,
  src: `/media/${row.storageKey}`,
  alt: row.alt,
  width: row.width,
  height: row.height,
  lqip: row.lqip,
});

/**
 * Rows and their images, shaped into domain objects.
 *
 * Split out of `hydrate` so the published-revision path and the D1 path share
 * it: a snapshot arrives with its images already in hand, and reimplementing
 * the shaping for it is how the two would drift.
 */
function shape(
  rows: Timeless<schema.PortfolioItemRow>[],
  images: schema.PortfolioImageRow[],
): PortfolioItem[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    information: row.information,
    status: row.status,
    parentId: row.parentId,
    pageId: row.pageId,
    clickable: row.clickable,
    x: row.x,
    y: row.y,
    width: row.width,
    z: row.z,
    images: images.filter((i) => i.itemId === row.id).map(toImage),
  }));
}

async function hydrate(rows: schema.PortfolioItemRow[]): Promise<PortfolioItem[]> {
  if (rows.length === 0) return [];
  const db = await getDb();

  const images = await db
    .select()
    .from(schema.portfolioImages)
    .where(
      inArray(
        schema.portfolioImages.itemId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(schema.portfolioImages.sortOrder));

  return shape(rows, images);
}

/**
 * The published content of one wall — the home page, a custom page, or a
 * piece's own page.
 *
 * One function for all three, because they differ only in the scope: the home
 * wall and a custom page's wall are the same feature pointed at a different
 * set of rows.
 *
 * "Published" now means two things at once: the piece is not a draft, and the
 * artist has pressed "Make live" since she placed it. The first is a property
 * of the row and the second of the site, which is why the source is chosen
 * here rather than filtered for.
 */
export const getPublishedWall = async (scope: WallScope = HOME_WALL): Promise<PortfolioItem[]> => {
  const source = await getSiteSource();
  if (source.kind === "live") {
    // Already status-filtered and z-ordered when the revision was built.
    return shape(
      source.snapshot.items.filter((row) => isOnWall(row, scope)),
      source.snapshot.itemImages,
    );
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(and(eq(schema.portfolioItems.status, "published"), onWall(schema.portfolioItems, scope)))
    .orderBy(asc(schema.portfolioItems.z));
  return hydrate(rows);
};

/** Admin needs drafts too, on whichever wall she is editing. */
export const getAllPortfolioItems = async (
  scope: WallScope = HOME_WALL,
): Promise<PortfolioItem[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(onWall(schema.portfolioItems, scope))
    .orderBy(asc(schema.portfolioItems.z));
  return hydrate(rows);
};

export const getPortfolioItemById = async (id: string): Promise<PortfolioItem | undefined> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.id, id))
    .limit(1);
  return rows.length === 0 ? undefined : (await hydrate(rows))[0];
};

// Children have no page of their own, and a piece that is not clickable has
// its page hidden rather than deleted — both must 404 rather than resolve.
// A piece on a custom page is not a child and does resolve: `page_id` says
// where it is shown, not whether it has a page.
const hasOwnPage = (row: Timeless<schema.PortfolioItemRow>): boolean =>
  row.status !== "draft" && row.parentId === null && row.clickable;

export const getPortfolioItemBySlug = async (slug: string): Promise<PortfolioItem | undefined> => {
  const source = await getSiteSource();
  if (source.kind === "live") {
    const row = source.snapshot.items.find((candidate) => candidate.slug === slug);
    if (row === undefined || !hasOwnPage(row)) return undefined;
    return shape([row], source.snapshot.itemImages)[0];
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.slug, slug))
    .limit(1);
  if (rows.length === 0 || !hasOwnPage(rows[0])) return undefined;
  return (await hydrate(rows))[0];
};

/**
 * Every `/work/<slug>` the sitemap should carry.
 *
 * Pieces shown on a custom page have pages of their own like any other, so
 * they belong here — but not while that custom page is still a draft, which is
 * what the join tests. A piece is never advertised through a page the artist
 * has not published.
 */
export const getRoutableWorkSlugs = async (): Promise<string[]> => {
  const source = await getSiteSource();
  if (source.kind === "live") {
    const livePages = new Set(
      source.snapshot.pages.filter((page) => page.status === "published").map((page) => page.id),
    );
    return source.snapshot.items
      .filter((row) => hasOwnPage(row) && (row.pageId === null || livePages.has(row.pageId)))
      .map((row) => row.slug);
  }

  const db = await getDb();
  const rows = await db
    .select({ slug: schema.portfolioItems.slug })
    .from(schema.portfolioItems)
    .leftJoin(schema.sitePages, eq(schema.portfolioItems.pageId, schema.sitePages.id))
    .where(
      and(
        eq(schema.portfolioItems.status, "published"),
        eq(schema.portfolioItems.clickable, true),
        isNull(schema.portfolioItems.parentId),
        or(isNull(schema.portfolioItems.pageId), eq(schema.sitePages.status, "published")),
      ),
    );
  return rows.map((r) => r.slug);
};

const toText = (row: Timeless<schema.WallTextRow>, fonts: FontOption[]): WallText => ({
  id: row.id,
  content: row.content,
  // Sanitised on the way out as well as in: a row can predate a rule, or have
  // been edited by hand.
  rich: parseDoc(row.rich, row.content, fonts),
  x: row.x,
  y: row.y,
  width: row.width,
  height: row.height,
  z: row.z,
  fontSize: row.fontSize,
  align: row.align,
  bold: row.bold,
  italic: row.italic,
  underline: row.underline,
  colour: row.colour,
  font: row.font,
  parentId: row.parentId,
  pageId: row.pageId,
});

export const getWallTexts = async (scope: WallScope = HOME_WALL): Promise<WallText[]> => {
  const source = await getSiteSource();
  /*
    The registry is needed to judge each run's font id, and the uploads live in
    their own table. Read once per call and passed down rather than held in a
    module variable: the isolate is shared between concurrent requests, so a
    module-level registry set just before an await is a race — one whose only
    symptom would be a run quietly losing its face.
  */
  const fonts = mergeFonts(await getSiteFonts());

  if (source.kind === "live") {
    return source.snapshot.texts
      .filter((row) => isOnWall(row, scope))
      .map((row) => toText(row, fonts));
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.wallTexts)
    .where(onWall(schema.wallTexts, scope))
    .orderBy(asc(schema.wallTexts.z));
  return rows.map((row) => toText(row, fonts));
};
