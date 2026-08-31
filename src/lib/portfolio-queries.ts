import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "./catalogue";
import type { PortfolioImage, PortfolioItem, WallText } from "./portfolio";

/**
 * D1 reads for the portfolio. Pure types and layout maths live in
 * src/lib/portfolio.ts so client components can use them.
 */

const toImage = (row: schema.PortfolioImageRow): PortfolioImage => ({
  id: row.id,
  src: `/media/${row.storageKey}`,
  alt: row.alt,
  width: row.width,
  height: row.height,
  lqip: row.lqip,
});

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

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    information: row.information,
    status: row.status,
    parentId: row.parentId,
    clickable: row.clickable,
    x: row.x,
    y: row.y,
    width: row.width,
    z: row.z,
    images: images.filter((i) => i.itemId === row.id).map(toImage),
  }));
}

/** The home wall: top-level pieces only. */
export const getPublishedPortfolio = async (): Promise<PortfolioItem[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(
      and(eq(schema.portfolioItems.status, "published"), isNull(schema.portfolioItems.parentId)),
    )
    .orderBy(asc(schema.portfolioItems.z));
  return hydrate(rows);
};

/**
 * Admin needs drafts too. `parentId` selects which wall: null is the home page,
 * an id is that piece's own page.
 */
export const getAllPortfolioItems = async (
  parentId: string | null = null,
): Promise<PortfolioItem[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(
      parentId === null
        ? isNull(schema.portfolioItems.parentId)
        : eq(schema.portfolioItems.parentId, parentId),
    )
    .orderBy(asc(schema.portfolioItems.z));
  return hydrate(rows);
};

/** Published elements of a piece's own page. */
export const getPublishedChildren = async (parentId: string): Promise<PortfolioItem[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(
      and(
        eq(schema.portfolioItems.status, "published"),
        eq(schema.portfolioItems.parentId, parentId),
      ),
    )
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

export const getPortfolioItemBySlug = async (slug: string): Promise<PortfolioItem | undefined> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.slug, slug))
    .limit(1);
  // Children have no page of their own, and a piece that is not clickable has
  // its page hidden rather than deleted — both must 404 rather than resolve.
  if (rows.length === 0) return undefined;
  const row = rows[0];
  if (row.status === "draft" || row.parentId !== null || !row.clickable) return undefined;
  return (await hydrate(rows))[0];
};

const toText = (row: schema.WallTextRow): WallText => ({
  id: row.id,
  content: row.content,
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
});

export const getWallTexts = async (parentId: string | null = null): Promise<WallText[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.wallTexts)
    .where(
      parentId === null
        ? isNull(schema.wallTexts.parentId)
        : eq(schema.wallTexts.parentId, parentId),
    )
    .orderBy(asc(schema.wallTexts.z));
  return rows.map(toText);
};
