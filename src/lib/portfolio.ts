/**
 * Portfolio types and the layout maths.
 *
 * Deliberately free of any database access: the admin canvas is a client
 * component and needs these helpers, so importing D1 here would break the
 * build. Queries live in src/lib/portfolio-queries.ts.
 */

/**
 * Which wall a piece or a text box sits on.
 *
 * There are three, and a row belongs to exactly one: the home page, a custom
 * page the artist added to the top bar, or a single piece's own page. The
 * database says this with two nullable columns — `parent_id` and `page_id` —
 * and a row with both set would belong to two walls at once. A union is the
 * only reason that state cannot be written: `scopeColumns` is the one place
 * the pair is produced, and every read goes through the matching clause in
 * src/lib/portfolio-queries.ts.
 *
 * The distinction is not merely bookkeeping. A piece on a custom page has no
 * parent, so `isInteractive` treats it exactly as a home-wall piece: it is
 * clickable and it gets a page of its own. A piece on *another piece's* page
 * does not, and must not.
 */
export type WallScope =
  { kind: "home" } | { kind: "page"; id: string } | { kind: "piece"; id: string };

export const HOME_WALL: WallScope = { kind: "home" };

/** The `parent_id` / `page_id` pair a scope writes. Never built by hand. */
export const scopeColumns = (
  scope: WallScope,
): { parentId: string | null; pageId: string | null } => ({
  parentId: scope.kind === "piece" ? scope.id : null,
  pageId: scope.kind === "page" ? scope.id : null,
});

/** The scope a row already stored is on. The inverse of `scopeColumns`. */
export const scopeOf = (row: { parentId: string | null; pageId: string | null }): WallScope =>
  row.parentId !== null
    ? { kind: "piece", id: row.parentId }
    : row.pageId !== null
      ? { kind: "page", id: row.pageId }
      : HOME_WALL;

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
  /** May be blank. A blank title means no hover overlay on the site. */
  name: string;
  information: string;
  status: "draft" | "published";
  /** Percentages of canvas width. See the schema for why y uses width too. */
  x: number;
  y: number;
  width: number;
  z: number;
  /** NULL for the home wall; set for an element on that piece's own page. */
  parentId: string | null;
  /** NULL for the home wall; set for a piece on that custom page. */
  pageId: string | null;
  clickable: boolean;
  images: PortfolioImage[];
}

/**
 * Roughly where the fold sits, in canvas-width percent.
 *
 * An estimate, and necessarily so: the server cannot know the viewport. The
 * canvas is 90vw, so on a 1280x900 screen the fold lands near 78 and on a
 * 1920x1080 near 62. Sixty-five is a middle value — it errs slightly towards
 * treating fewer pieces as above the fold, so the cost of being wrong is a
 * lazily loaded image rather than a needless eager one.
 */
export const ESTIMATED_FOLD = 65;

export const isLikelyAboveFold = (item: PortfolioItem, fold = ESTIMATED_FOLD): boolean =>
  item.y < fold;

/** Rendered area, in canvas-width percent squared. */
const renderedArea = (item: PortfolioItem): number => item.width * item.width * aspectOf(item);

/**
 * The piece most likely to be the Largest Contentful Paint.
 *
 * Next.js warns when the LCP image is lazily loaded, because the browser
 * cannot begin fetching it until layout proves it is needed. Picking by index
 * was wrong twice over: the array is ordered by layer, not position, and the
 * first layer is rarely the biggest thing on screen.
 *
 * Falls back to the largest piece overall when nothing is above the fold, so
 * there is always something to prioritise.
 */
export const lcpCandidateId = (items: PortfolioItem[]): string | null => {
  const withCovers = items.filter((item) => coverImage(item));
  if (withCovers.length === 0) return null;

  const aboveFold = withCovers.filter((item) => isLikelyAboveFold(item));
  const pool = aboveFold.length > 0 ? aboveFold : withCovers;

  return pool.reduce((best, item) => (renderedArea(item) > renderedArea(best) ? item : best)).id;
};

/**
 * The pieces worth loading eagerly — at most two, usually one.
 *
 * The two layouts do not agree on which image is the Largest Contentful Paint,
 * and one set of markup serves both. Above `md` it is the biggest piece near
 * the top of the arrangement; below `md` that arrangement does not exist and
 * the LCP is simply whatever heads the stack, which is the first piece in
 * reading order. Prioritising only the desktop answer left the mobile LCP
 * lazily loaded — which Next warns about, and which costs the metric the brief
 * puts a budget on.
 *
 * They are frequently the same piece, and never more than two, so this is a
 * preload of one image or two rather than the first-screenful fan-out that
 * previously flooded a phone.
 */
export const eagerIds = (items: PortfolioItem[]): Set<string> => {
  const ids = new Set<string>();

  const desktop = lcpCandidateId(items);
  if (desktop) ids.add(desktop);

  const mobile = inReadingOrder(items.filter((item) => coverImage(item)))[0];
  if (mobile) ids.add(mobile.id);

  return ids;
};

/**
 * Whether a visitor can click through to a piece's own page.
 *
 * Elements placed on a piece's page are always inert: they are part of that
 * page's composition, not links to further pages. A custom page is not a
 * piece's page — it is a wall of its own — so `pageId` is deliberately absent
 * from this test and work shown there behaves exactly as it does at home.
 */
export const isInteractive = (item: PortfolioItem): boolean =>
  item.clickable && item.parentId === null;

/**
 * Whether the dark hover overlay with the piece's name should appear.
 *
 * A blank title means nothing happens on hover, which is what lets the artist
 * place decorative marks and icons that do not advertise themselves as
 * clickable. Kept here rather than in a component so the editor and the site
 * cannot disagree about it.
 */
export const showsHoverName = (item: PortfolioItem, showNames: boolean): boolean =>
  showNames && isInteractive(item) && item.name.trim() !== "";

/** The cover shown on the wall, if the piece has any images yet. */
export const coverImage = (item: PortfolioItem): PortfolioImage | undefined => item.images[0];

import { resolveFontFamily, type FontOption } from "./fonts";
import type { RichDoc } from "./rich-text";

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
  /** The plain-text mirror: the heading choice and metadata read this. */
  content: string;
  /** The rich document. Parsed and sanitised on read — see src/lib/rich-text.ts. */
  rich: RichDoc;
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
  /** A key into the font registry; see src/lib/fonts.ts. */
  font: string;
  /** NULL for the home wall; set for an element on that piece's own page. */
  parentId: string | null;
  /** NULL for the home wall; set for a text box on that custom page. */
  pageId: string | null;
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
 * Type styles for a text box, other than its size.
 *
 * Sizes are `cqw` — percentages of the containing canvas — which keeps type in
 * proportion as the wall scales, exactly like the pieces. The container must
 * therefore declare `container-type: inline-size`.
 */
export const textStyle = (
  text: WallText,
  { includeFontSize = true, fonts }: { includeFontSize?: boolean; fonts?: FontOption[] } = {},
): React.CSSProperties => ({
  // `fonts` stays an argument for when the artist can upload her own: callers
  // will pass the built-in list merged with hers. See src/lib/fonts.ts.
  fontFamily: resolveFontFamily(text.font, fonts),
  // Omitted on the public wall, where a stylesheet sets the size from a custom
  // property so one element can be sized differently per breakpoint. The
  // editor canvas is desktop-only and takes the concrete value.
  ...(includeFontSize ? { fontSize: `${text.fontSize}cqw` } : {}),
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
 * The empty band the wall keeps below the lowest element, in canvas-width
 * percent. Part of the wall itself, so a visitor sees it too.
 */
export const WALL_HEADROOM = 12;

/**
 * The band the editor draws *above* the wall, in canvas-width percent.
 *
 * Deliberately not part of `canvasHeightRatio`, and therefore invisible on the
 * public site. The bottom can afford a margin because `y` is measured down
 * from the top: trailing space costs nothing and no element's coordinate
 * depends on it. Space above the top is the opposite — the top is the datum,
 * so every element would have to move to accommodate it. Baking it in here
 * would silently push every wall the artist has already composed down the
 * published page.
 *
 * So the band exists only in the editor, as somewhere to drop work that
 * belongs above everything else. Twenty is chosen so a default-sized piece —
 * 28 wide on a 4:3 box, 21 tall — can be lifted essentially clear of the
 * arrangement in a single gesture.
 */
export const EDITOR_TOP_ROOM = 20;

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
  return Math.max(80, ...bottoms) + WALL_HEADROOM;
};

/**
 * Moves a whole wall down, so that something can sit above what was its top.
 *
 * The wall grows downward on its own — `canvasHeightRatio` reads the lowest
 * element — but it cannot grow upward the same way, because `y` is measured
 * from the top and the top is fixed at zero. Making room above therefore means
 * moving everything else: shift the arrangement down by the amount that
 * overhangs, and the element that overhung lands at zero as the new top.
 * Relative positions are untouched, so the composition is preserved exactly.
 *
 * There is no matching shrink, and there must not be. Pulling the wall up
 * whenever its topmost element moved down would mean dragging that element
 * down did nothing at all — everything else would follow it, and the artist
 * would see the whole wall lurch instead of one piece move.
 */
export const shiftedDown = <T extends { y: number }>(rows: T[], by: number): T[] =>
  by > 0 ? rows.map((row) => ({ ...row, y: row.y + by })) : rows;
