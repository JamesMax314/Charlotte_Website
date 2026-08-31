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

export type TextAlign = "left" | "center" | "right";

/**
 * Free-floating text on the wall.
 *
 * Shares the piece coordinate system — percentages of canvas width — but
 * carries an explicit height, because there is no image aspect ratio to derive
 * one from. `fontSize` is also a percentage of canvas width, which is what
 * keeps type in proportion as the wall scales.
 */
export interface WallText {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  fontSize: number;
  align: TextAlign;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  colour: string;
}

/**
 * Which text box acts as the page heading.
 *
 * Replacing the fixed heading with free text boxes left the home page with no
 * <h1> at all, which costs both search ranking and screen-reader navigation.
 * The largest text is treated as the heading — ties go to whichever sits
 * highest — so the artist gets the right markup without having to think about
 * it. Everything else renders as a paragraph.
 */
export const headingTextId = (texts: WallText[]): string | null => {
  const withContent = texts.filter((t) => t.content.trim() !== "");
  if (withContent.length === 0) return null;

  return withContent.reduce((best, candidate) =>
    candidate.fontSize > best.fontSize ||
    (candidate.fontSize === best.fontSize && candidate.y < best.y)
      ? candidate
      : best,
  ).id;
};

/**
 * Type styles for a text box.
 *
 * Sizes are given in `cqw` — percentages of the containing canvas — which is
 * what keeps type in proportion as the wall scales, exactly like the pieces.
 * The canvas must therefore declare `container-type: inline-size`.
 *
 * `clamped` is for the mobile stack, where the container is a narrow phone
 * rather than the wall: raw cqw there would render body copy at about six
 * pixels.
 */
export const textStyle = (
  text: WallText,
  { clamped = false }: { clamped?: boolean } = {},
): React.CSSProperties => ({
  fontSize: clamped ? `clamp(0.95rem, ${text.fontSize}cqw, 2.5rem)` : `${text.fontSize}cqw`,
  textAlign: text.align,
  fontWeight: text.bold ? 700 : 400,
  fontStyle: text.italic ? "italic" : "normal",
  textDecoration: text.underline ? "underline" : "none",
  color: text.colour,
});

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
export const canvasHeightRatio = (items: PortfolioItem[], texts: WallText[] = []): number => {
  const bottoms = [
    ...items.map((item) => item.y + item.width * aspectOf(item)),
    ...texts.map((t) => t.y + t.height),
  ];

  // Headroom matters: the editor must derive this from committed positions
  // only. Deriving it from the live drag made the canvas grow as a piece was
  // dragged down, which shifted every other piece and fought the drag.
  return Math.max(80, ...bottoms) + 12;
};
