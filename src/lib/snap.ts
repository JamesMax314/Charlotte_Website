/**
 * Edge snapping for the portfolio wall.
 *
 * Pure geometry, deliberately free of React and of the database, so the
 * behaviour can be tested directly rather than by dragging things in a browser.
 *
 * Every value is in the wall's own unit: percentages of canvas WIDTH, on both
 * axes. See src/db/schema.ts for why the vertical axis uses width too.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Which edge of the box being moved may snap to a guide.
 *
 * Recording this is what makes a gutter mean anything. Without it every edge
 * could snap to every line, so a piece's trailing edge would land on a
 * neighbour's leading edge — flush, no gap — and compete with the gutter
 * position. Pieces then came to rest at a mixture of spacings.
 */
export type EdgeRole = "leading" | "centre" | "trailing";

export interface Guide {
  at: number;
  edges: EdgeRole[];
}

export interface Guides {
  vertical: Guide[];
  horizontal: Guide[];
}

export interface SnapResult {
  x: number;
  y: number;
  /** The guides actually snapped to, for drawing. Null when nothing snapped. */
  vertical: number | null;
  horizontal: number | null;
}

/** How close an edge must come before it snaps, in canvas-width percent. */
export const SNAP_THRESHOLD = 1.2;

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Merges guides that land on the same line, unioning the edges they accept. */
export function collapse(guides: Guide[]): Guide[] {
  const byPosition = new Map<number, Set<EdgeRole>>();
  for (const guide of guides) {
    const at = round(guide.at);
    const edges = byPosition.get(at) ?? new Set<EdgeRole>();
    for (const edge of guide.edges) edges.add(edge);
    byPosition.set(at, edges);
  }

  return [...byPosition.entries()]
    .map(([at, edges]) => ({ at, edges: [...edges] }))
    .sort((a, b) => a.at - b.at);
}

/** No guides at all — what a wall with its snapping switched off offers. */
export const NO_GUIDES: Guides = { vertical: [], horizontal: [] };

/**
 * Combines two sets of guides into one, so a wall with both edge snapping and
 * the alignment grid on offers every line and the nearest simply wins.
 *
 * Lines that coincide are merged and their edge roles unioned, which is why a
 * grid line landing on a neighbour's edge widens what may reach it rather than
 * competing with it.
 */
export const mergeGuides = (a: Guides, b: Guides): Guides => ({
  vertical: collapse([...a.vertical, ...b.vertical]),
  horizontal: collapse([...a.horizontal, ...b.horizontal]),
});

export const rectOf = (item: { x: number; y: number; width: number }, aspect: number): Rect => ({
  x: item.x,
  y: item.y,
  width: item.width,
  height: item.width * aspect,
});

/**
 * Every line a dragged piece can snap to: the edges and centre of each other
 * piece, plus the canvas edges and its vertical centre line.
 */
export const collectGuides = (others: Rect[], canvasHeight: number, gutter = 0): Guides => {
  const vertical: Guide[] = [
    { at: 0, edges: ["leading"] },
    { at: 50, edges: ["centre"] },
    { at: 100, edges: ["trailing"] },
  ];
  const horizontal: Guide[] = [
    { at: 0, edges: ["leading"] },
    { at: canvasHeight, edges: ["trailing"] },
  ];

  for (const r of others) {
    // Alignment: line the same edge up with a neighbour's — left with left,
    // centre with centre, right with right.
    vertical.push(
      { at: r.x, edges: ["leading"] },
      { at: r.x + r.width / 2, edges: ["centre"] },
      { at: r.x + r.width, edges: ["trailing"] },
    );
    horizontal.push(
      { at: r.y, edges: ["leading"] },
      { at: r.y + r.height / 2, edges: ["centre"] },
      { at: r.y + r.height, edges: ["trailing"] },
    );

    /*
      Abutting: sit beside a neighbour, one gutter away. Only the facing edge
      may use these, which is what stops a piece also snapping flush and
      leaving a mixture of spacings across the wall.

      The gutter is measured in the same unit on both axes — percentages of
      canvas width — so a horizontal and a vertical gap are the same distance
      on screen.
    */
    vertical.push(
      { at: r.x - gutter, edges: ["trailing"] },
      { at: r.x + r.width + gutter, edges: ["leading"] },
    );
    horizontal.push(
      { at: r.y - gutter, edges: ["trailing"] },
      { at: r.y + r.height + gutter, edges: ["leading"] },
    );
  }

  return { vertical: collapse(vertical), horizontal: collapse(horizontal) };
};

/**
 * Finds the closest guide to any of the moving edges.
 *
 * `offsets` are the distances from the rect's origin to each candidate edge —
 * 0, half and full, meaning leading edge, centre and trailing edge.
 */
function nearest(
  origin: number,
  candidates: { role: EdgeRole; offset: number }[],
  guides: Guide[],
  threshold: number,
): { position: number; guide: number } | null {
  let best: { position: number; guide: number; delta: number } | null = null;

  for (const candidate of candidates) {
    for (const guide of guides) {
      // A guide only accepts the edges it was created for.
      if (!guide.edges.includes(candidate.role)) continue;

      const delta = Math.abs(guide.at - (origin + candidate.offset));
      if (delta > threshold) continue;
      if (!best || delta < best.delta) {
        best = { position: guide.at - candidate.offset, guide: guide.at, delta };
      }
    }
  }

  return best ? { position: best.position, guide: best.guide } : null;
}

/** Snaps a piece being moved. Its size never changes. */
export const snapMove = (rect: Rect, guides: Guides, threshold = SNAP_THRESHOLD): SnapResult => {
  const h = nearest(
    rect.x,
    [
      { role: "leading", offset: 0 },
      { role: "centre", offset: rect.width / 2 },
      { role: "trailing", offset: rect.width },
    ],
    guides.vertical,
    threshold,
  );
  const v = nearest(
    rect.y,
    [
      { role: "leading", offset: 0 },
      { role: "centre", offset: rect.height / 2 },
      { role: "trailing", offset: rect.height },
    ],
    guides.horizontal,
    threshold,
  );

  return {
    x: h ? h.position : rect.x,
    y: v ? v.position : rect.y,
    vertical: h ? h.guide : null,
    horizontal: v ? v.guide : null,
  };
};

export interface ResizeSnapResult {
  width: number;
  vertical: number | null;
  horizontal: number | null;
}

/**
 * Snaps a piece being resized from its bottom-right corner.
 *
 * Only width is adjustable — height follows the image's aspect ratio — so a
 * bottom-edge snap is solved back into a width rather than applied directly.
 */
export const snapResize = (
  rect: Rect,
  aspect: number,
  guides: Guides,
  threshold = SNAP_THRESHOLD,
): ResizeSnapResult => {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.width * aspect;

  // Resizing from the bottom-right corner moves only the trailing edges, so
  // only guides that accept a trailing edge apply. With a gutter set this is
  // what stops a piece being resized flush against its neighbour.
  const trailing = (list: Guide[]) => list.filter((g) => g.edges.includes("trailing"));

  let best: {
    width: number;
    delta: number;
    vertical: number | null;
    horizontal: number | null;
  } | null = null;

  for (const guide of trailing(guides.vertical)) {
    const delta = Math.abs(guide.at - right);
    if (delta > threshold) continue;
    if (!best || delta < best.delta) {
      best = { width: guide.at - rect.x, delta, vertical: guide.at, horizontal: null };
    }
  }

  if (aspect > 0) {
    for (const guide of trailing(guides.horizontal)) {
      const delta = Math.abs(guide.at - bottom);
      if (delta > threshold) continue;
      // Compare in width-space so the two axes are judged on the same scale.
      const widthDelta = delta / aspect;
      if (!best || widthDelta < best.delta) {
        best = {
          width: (guide.at - rect.y) / aspect,
          delta: widthDelta,
          vertical: null,
          horizontal: guide.at,
        };
      }
    }
  }

  if (!best || best.width <= 0) {
    return { width: rect.width, vertical: null, horizontal: null };
  }

  return { width: best.width, vertical: best.vertical, horizontal: best.horizontal };
};

export interface FreeResizeSnapResult {
  width: number;
  height: number;
  vertical: number | null;
  horizontal: number | null;
}

/**
 * Snaps a box resized freely in both directions.
 *
 * Text boxes have no aspect ratio to preserve — there is no artwork to
 * distort — so the two axes are independent and each snaps on its own.
 */
export const snapResizeFree = (
  rect: Rect,
  guides: Guides,
  threshold = SNAP_THRESHOLD,
): FreeResizeSnapResult => {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const trailing = (list: Guide[]) => list.filter((g) => g.edges.includes("trailing"));

  let width = rect.width;
  let vertical: number | null = null;
  let bestV = threshold;
  for (const guide of trailing(guides.vertical)) {
    const delta = Math.abs(guide.at - right);
    if (delta <= bestV && guide.at - rect.x > 0) {
      bestV = delta;
      width = guide.at - rect.x;
      vertical = guide.at;
    }
  }

  let height = rect.height;
  let horizontal: number | null = null;
  let bestH = threshold;
  for (const guide of trailing(guides.horizontal)) {
    const delta = Math.abs(guide.at - bottom);
    if (delta <= bestH && guide.at - rect.y > 0) {
      bestH = delta;
      height = guide.at - rect.y;
      horizontal = guide.at;
    }
  }

  return { width, height, vertical, horizontal };
};
