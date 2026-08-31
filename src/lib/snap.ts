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

export interface Guides {
  vertical: number[];
  horizontal: number[];
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

const dedupe = (values: number[]) => [...new Set(values.map(round))].sort((a, b) => a - b);

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
export const collectGuides = (others: Rect[], canvasHeight: number): Guides => {
  const vertical = [0, 50, 100];
  const horizontal = [0, canvasHeight];

  for (const r of others) {
    vertical.push(r.x, r.x + r.width / 2, r.x + r.width);
    horizontal.push(r.y, r.y + r.height / 2, r.y + r.height);
  }

  return { vertical: dedupe(vertical), horizontal: dedupe(horizontal) };
};

/**
 * Finds the closest guide to any of the moving edges.
 *
 * `offsets` are the distances from the rect's origin to each candidate edge —
 * 0, half and full, meaning leading edge, centre and trailing edge.
 */
function nearest(
  origin: number,
  offsets: number[],
  guides: number[],
  threshold: number,
): { position: number; guide: number } | null {
  let best: { position: number; guide: number; delta: number } | null = null;

  for (const offset of offsets) {
    for (const guide of guides) {
      const delta = Math.abs(guide - (origin + offset));
      if (delta > threshold) continue;
      if (!best || delta < best.delta) {
        best = { position: guide - offset, guide, delta };
      }
    }
  }

  return best ? { position: best.position, guide: best.guide } : null;
}

/** Snaps a piece being moved. Its size never changes. */
export const snapMove = (rect: Rect, guides: Guides, threshold = SNAP_THRESHOLD): SnapResult => {
  const h = nearest(rect.x, [0, rect.width / 2, rect.width], guides.vertical, threshold);
  const v = nearest(rect.y, [0, rect.height / 2, rect.height], guides.horizontal, threshold);

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

  let best: {
    width: number;
    delta: number;
    vertical: number | null;
    horizontal: number | null;
  } | null = null;

  for (const guide of guides.vertical) {
    const delta = Math.abs(guide - right);
    if (delta > threshold) continue;
    if (!best || delta < best.delta) {
      best = { width: guide - rect.x, delta, vertical: guide, horizontal: null };
    }
  }

  if (aspect > 0) {
    for (const guide of guides.horizontal) {
      const delta = Math.abs(guide - bottom);
      if (delta > threshold) continue;
      // Compare in width-space so the two axes are judged on the same scale.
      const widthDelta = delta / aspect;
      if (!best || widthDelta < best.delta) {
        best = {
          width: (guide - rect.y) / aspect,
          delta: widthDelta,
          vertical: null,
          horizontal: guide,
        };
      }
    }
  }

  if (!best || best.width <= 0) {
    return { width: rect.width, vertical: null, horizontal: null };
  }

  return { width: best.width, vertical: best.vertical, horizontal: best.horizontal };
};
