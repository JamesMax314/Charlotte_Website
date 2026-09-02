/**
 * Multi-selection geometry for the wall.
 *
 * Pure maths, free of React and of the database, for the same reason
 * `src/lib/snap.ts` is: dragging a rectangle over a wall in a browser is a
 * terrible way to find out whether the arithmetic is right.
 *
 * Every value is in the wall's own unit — percentages of canvas WIDTH, on both
 * axes — so a distance here means the same thing on screen whichever way it
 * points.
 */

import { clampTo, WALL_LIMITS, WALL_TEXT_CQW } from "./portfolio";
import type { Guide, Guides, Rect } from "./snap";
import { SNAP_THRESHOLD } from "./snap";

export type SelectionKind = "item" | "text";

/**
 * One member of a selection, as the group maths needs it.
 *
 * A piece and a text box are the same shape here on purpose: the whole point
 * of the feature is that the two move and scale together. `fontSize` is what
 * makes them differ — a text box's type is a separate size from its box, so a
 * group scale that ignored it would leave the words at their old size inside a
 * box that had grown around them.
 */
export interface SelectedElement {
  kind: SelectionKind;
  id: string;
  x: number;
  y: number;
  width: number;
  /** A piece's height follows its cover image; a text box's is its own. */
  height: number;
  /** Text boxes only, in cqw. */
  fontSize?: number;
}

/** The rectangle two corners describe, whichever way round they were dragged. */
export const marqueeRect = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): Rect => ({
  x: Math.min(from.x, to.x),
  y: Math.min(from.y, to.y),
  width: Math.abs(to.x - from.x),
  height: Math.abs(to.y - from.y),
});

/**
 * Whether two rectangles overlap at all.
 *
 * Touching counts as a miss, and a rectangle with no area overlaps nothing —
 * which is what a click on empty canvas draws. Strict comparison alone does
 * not cover that case: a point *inside* an element passes every edge test, so
 * without the area guard the gesture that clears the selection would instead
 * select whatever the pointer came down on. Every wall element has area, since
 * a piece with no photograph still uses the 4:3 box the editor draws.
 */
export const overlaps = (a: Rect, b: Rect): boolean =>
  a.width > 0 &&
  a.height > 0 &&
  b.width > 0 &&
  b.height > 0 &&
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const rectOfElement = (element: SelectedElement): Rect => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
});

/**
 * The ids a marquee catches.
 *
 * Anything the rectangle touches is caught, rather than only what it fully
 * encloses. On a wall where work is deliberately overlapped and bled past the
 * edges, "fully enclosed" catches nothing most of the time and reads as a
 * broken gesture.
 */
export const caughtBy = (elements: SelectedElement[], marquee: Rect): string[] =>
  elements.filter((element) => overlaps(rectOfElement(element), marquee)).map((e) => e.id);

/** The box enclosing a selection, or null when nothing is selected. */
export const boundsOf = (elements: SelectedElement[]): Rect | null => {
  if (elements.length === 0) return null;

  const left = Math.min(...elements.map((e) => e.x));
  const top = Math.min(...elements.map((e) => e.y));
  const right = Math.max(...elements.map((e) => e.x + e.width));
  const bottom = Math.max(...elements.map((e) => e.y + e.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * Moves a whole selection.
 *
 * The group is clamped as one body rather than element by element: clamping
 * each in turn would let the topmost stop at the wall's top edge while the
 * rest carried on, silently rearranging work the artist had already placed.
 */
export const moveSelection = (
  elements: SelectedElement[],
  delta: { x: number; y: number },
): SelectedElement[] => {
  const bounds = boundsOf(elements);
  if (!bounds) return elements;

  // The wall has no top above zero, so the group stops when its own top does.
  const dy = Math.max(delta.y, -bounds.y);

  return elements.map((element) => ({ ...element, x: element.x + delta.x, y: element.y + dy }));
};

/**
 * Scales a selection about the top-left corner of its bounding box.
 *
 * One factor for both axes, always. A piece's height follows its cover image
 * precisely so artwork cannot be stretched out of shape, so there is no
 * meaningful way to scale a group containing one non-uniformly.
 *
 * Each element is clamped on its own, so a text box already at the smallest
 * type the wall allows stops shrinking while the pictures beside it carry on.
 * That is a deliberate choice over blocking the whole gesture: one small
 * caption should not be able to freeze a group scale for no visible reason.
 * Nothing drifts within a gesture, because every frame is computed from the
 * sizes the group started at rather than from the last frame.
 */
export const scaleSelection = (
  elements: SelectedElement[],
  origin: { x: number; y: number },
  factor: number,
): SelectedElement[] =>
  elements.map((element) => {
    const width = clampTo(element.width * factor, WALL_LIMITS.width);

    // A piece's aspect ratio is the one thing a scale must not touch, so its
    // height is re-derived from the width that was actually allowed.
    const aspect = element.width === 0 ? 0 : element.height / element.width;
    const height =
      element.kind === "item"
        ? width * aspect
        : clampTo(element.height * factor, WALL_LIMITS.height);

    return {
      ...element,
      x: origin.x + (element.x - origin.x) * factor,
      y: Math.max(0, origin.y + (element.y - origin.y) * factor),
      width,
      height,
      ...(element.fontSize === undefined
        ? {}
        : { fontSize: clampTo(element.fontSize * factor, WALL_TEXT_CQW) }),
    };
  });

/** Never let a group be scaled away to nothing, or flipped inside out. */
export const SCALE_LIMITS = { min: 0.05, max: 20 } as const;

/**
 * The factor a corner drag asks for.
 *
 * Both axes are offered and the one the artist moved further, relative to the
 * size of the group on that axis, wins. Taking width alone would make the
 * handle feel dead when dragged downward on a tall, narrow selection.
 */
export const scaleFactorFor = (bounds: Rect, delta: { x: number; y: number }): number => {
  const fx = bounds.width === 0 ? 1 : (bounds.width + delta.x) / bounds.width;
  const fy = bounds.height === 0 ? 1 : (bounds.height + delta.y) / bounds.height;
  const factor = Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy;

  return clampTo(factor, SCALE_LIMITS);
};

export interface ScaleSnapResult {
  factor: number;
  vertical: number | null;
  horizontal: number | null;
}

/**
 * Snaps a group scale by its bounding box's trailing edges.
 *
 * Scaling from the bottom-right corner moves only those edges, so only guides
 * that accept a trailing edge apply — the same rule `snapResize` follows for a
 * single piece, and for the same reason: with a gutter set, a group must not
 * be able to come to rest flush against its neighbour.
 *
 * The two axes are compared in width-space before a winner is chosen, so a
 * tall selection does not always lose to its own height.
 */
export const snapScaleFactor = (
  bounds: Rect,
  factor: number,
  guides: Guides,
  threshold = SNAP_THRESHOLD,
): ScaleSnapResult => {
  if (bounds.width === 0 || bounds.height === 0) {
    return { factor, vertical: null, horizontal: null };
  }

  const trailing = (list: Guide[]) => list.filter((g) => g.edges.includes("trailing"));
  const right = bounds.x + bounds.width * factor;
  const bottom = bounds.y + bounds.height * factor;

  let best: ScaleSnapResult & { delta: number } = {
    factor,
    vertical: null,
    horizontal: null,
    delta: threshold,
  };

  for (const guide of trailing(guides.vertical)) {
    const delta = Math.abs(guide.at - right);
    const snapped = (guide.at - bounds.x) / bounds.width;
    if (delta <= best.delta && snapped > 0) {
      best = { factor: snapped, vertical: guide.at, horizontal: null, delta };
    }
  }

  for (const guide of trailing(guides.horizontal)) {
    // Judged on the same scale as the vertical candidates, or the axis with
    // the larger numbers would win every time.
    const delta = Math.abs(guide.at - bottom) * (bounds.width / bounds.height);
    const snapped = (guide.at - bounds.y) / bounds.height;
    if (delta <= best.delta && snapped > 0) {
      best = { factor: snapped, vertical: null, horizontal: guide.at, delta };
    }
  }

  return {
    factor: clampTo(best.factor, SCALE_LIMITS),
    vertical: best.vertical,
    horizontal: best.horizontal,
  };
};

export type AlignMode = "left" | "centre-x" | "right" | "top" | "centre-y" | "bottom";

/**
 * Lines a selection up against its own bounding box.
 *
 * Against the box rather than against a nominated element, because the box is
 * the thing the artist can see — the accent rectangle drawn around what she
 * picked. Aligning to a "key" element means knowing which one is key, and
 * nothing on this wall says so.
 */
export const alignSelection = (elements: SelectedElement[], mode: AlignMode): SelectedElement[] => {
  const bounds = boundsOf(elements);
  if (!bounds || elements.length < 2) return elements;

  return elements.map((element) => {
    switch (mode) {
      case "left":
        return { ...element, x: bounds.x };
      case "centre-x":
        return { ...element, x: bounds.x + (bounds.width - element.width) / 2 };
      case "right":
        return { ...element, x: bounds.x + bounds.width - element.width };
      case "top":
        return { ...element, y: bounds.y };
      case "centre-y":
        return { ...element, y: bounds.y + (bounds.height - element.height) / 2 };
      case "bottom":
        return { ...element, y: bounds.y + bounds.height - element.height };
    }
  });
};

/**
 * Spreads a selection so the gaps between neighbours are equal.
 *
 * Equal *gaps*, not equal centres: on a wall where a wide picture sits beside
 * a narrow one, equal centres leaves visibly different amounts of white
 * between them, which is the thing the artist is actually trying to fix.
 *
 * The outermost two do not move — they are what defines the span — so this
 * needs three elements to mean anything.
 */
export const distributeSelection = (
  elements: SelectedElement[],
  axis: "horizontal" | "vertical",
): SelectedElement[] => {
  const bounds = boundsOf(elements);
  if (!bounds || elements.length < 3) return elements;

  const along = axis === "horizontal" ? ("x" as const) : ("y" as const);
  const across = axis === "horizontal" ? ("width" as const) : ("height" as const);

  const order = [...elements].sort((a, b) => a[along] - b[along]);
  const span = axis === "horizontal" ? bounds.width : bounds.height;
  const occupied = order.reduce((total, element) => total + element[across], 0);
  const gap = (span - occupied) / (order.length - 1);

  const placed = new Map<string, number>();
  let cursor = bounds[along];
  for (const element of order) {
    placed.set(element.id, cursor);
    cursor += element[across] + gap;
  }

  return elements.map((element) => ({
    ...element,
    [along]: placed.get(element.id) ?? element[along],
  }));
};
