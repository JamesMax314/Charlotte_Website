import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
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
    x: row.x,
    y: row.y,
    width: row.width,
    z: row.z,
    images: images.filter((i) => i.itemId === row.id).map(toImage),
  }));
}

export const getPublishedPortfolio = async (): Promise<PortfolioItem[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.status, "published"))
    .orderBy(asc(schema.portfolioItems.z));
  return hydrate(rows);
};

/** Admin needs drafts too. */
export const getAllPortfolioItems = async (): Promise<PortfolioItem[]> => {
  const db = await getDb();
  const rows = await db.select().from(schema.portfolioItems).orderBy(asc(schema.portfolioItems.z));
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
  if (rows.length === 0 || rows[0].status === "draft") return undefined;
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
});

export const getWallTexts = async (): Promise<WallText[]> => {
  const db = await getDb();
  const rows = await db.select().from(schema.wallTexts).orderBy(asc(schema.wallTexts.z));
  return rows.map(toText);
};
