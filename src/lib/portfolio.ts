/**
 * Portfolio types and the layout maths.
 *
 * Deliberately free of any database access: the admin canvas is a client
 * component and needs these helpers, so importing D1 here would break the
 * build. Queries live in src/lib/portfolio-queries.ts.
 */

export interface PortfolioImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  lqip?: string | null;
}

export interface PortfolioItem {
  id: string;
  slug: string;
  name: string;
  information: string;
  status: "draft" | "published";
  /** Percentages of canvas width. See the schema for why y uses width too. */
  x: number;
  y: number;
  width: number;
  z: number;
  images: PortfolioImage[];
}

/** The cover shown on the wall, if the piece has any images yet. */
export const coverImage = (item: PortfolioItem): PortfolioImage | undefined => item.images[0];

/**
 * A piece's height as a multiple of its width.
 *
 * Heights are never stored — they come from the cover image — which is what
 * stops a resize from distorting artwork. Pieces with no photograph yet use the
 * same 4:3 box the editor draws as a placeholder.
 */
export const aspectOf = (item: PortfolioItem): number => {
  const cover = coverImage(item);
  return cover ? cover.height / cover.width : 0.75;
};

/**
 * Reading order for the mobile stack: top to bottom, then left to right.
 *
 * Derived from the arrangement rather than stored separately, so the artist
 * never has to maintain a second ordering that can drift out of step.
 */
export const inReadingOrder = (items: PortfolioItem[]): PortfolioItem[] =>
  [...items].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

/**
 * How tall the wall must be, as a percentage of its width.
 *
 * Computed from the lowest piece rather than stored, so the canvas always fits
 * the arrangement and the artist never has to set a height by hand.
 */
export const canvasHeightRatio = (items: PortfolioItem[]): number => {
  const bottoms = items.map((item) => item.y + item.width * aspectOf(item));

  // Headroom matters: the editor must derive this from committed positions
  // only. Deriving it from the live drag made the canvas grow as a piece was
  // dragged down, which shifted every other piece and fought the drag.
  return Math.max(80, ...bottoms) + 12;
};
