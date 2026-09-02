/**
 * The alignment grid the artist can lay over a free-form wall.
 *
 * Pure geometry, like snap.ts, and in the wall's own unit: percentages of
 * canvas WIDTH on both axes. Because the vertical axis is measured in width
 * too, one spacing gives genuinely square cells without a second number.
 *
 * The grid is an editor aid. Nothing here reaches a visitor — it is never
 * rendered by the public wall and never enters a publish snapshot.
 */

import { collapse, type Guide, type Guides } from "./snap";

/**
 * The spacings on offer, as columns across the width.
 *
 * Columns rather than a percentage because every count here divides by four,
 * so the quarter and centre lines always land exactly on a grid line and can
 * be drawn heavier. A free percentage would put them between lines at most
 * values, and the emphasis would read as a mistake.
 */
export const GRID_COLUMN_CHOICES = [4, 8, 12, 16, 20, 24] as const;

export const DEFAULT_GRID_COLUMNS = 12;

/** The fractions of the wall's height drawn heavier, alongside the centre. */
const MAJOR_FRACTIONS = [0.25, 0.5, 0.75];

export type GridLine = { at: number; major: boolean };

export interface GridLines {
  /** Distance between neighbouring lines, in canvas-width percent. */
  spacing: number;
  /** Lines down the wall, positioned across its width. */
  vertical: GridLine[];
  /** Lines across the wall, positioned down it. */
  horizontal: GridLine[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Falls back to the default rather than trusting a number off a form or a row. */
export const resolveGridColumns = (columns: number): number =>
  (GRID_COLUMN_CHOICES as readonly number[]).includes(columns) ? columns : DEFAULT_GRID_COLUMNS;

/**
 * Every line of the grid, interior only.
 *
 * The lines at the very edges are left out because the canvas already draws
 * its own border there; a dashed line beneath it would only thicken the frame.
 * `gridGuides` puts the edges back, since they are still worth snapping to.
 *
 * The two axes are emphasised differently, and deliberately so. Across the
 * width, a quarter is a fixed fraction of a fixed span, so 25/50/75 fall on
 * grid lines. Down the wall there is no fixed span — the wall grows to fit the
 * lowest element — so the quarters are taken of the height as it currently
 * stands and will move as the arrangement does.
 */
export const gridLines = (columns: number, canvasHeight: number): GridLines => {
  const count = resolveGridColumns(columns);
  const spacing = 100 / count;

  const vertical: GridLine[] = [];
  for (let k = 1; k < count; k += 1) {
    const at = round((k * 100) / count);
    // count is always a multiple of four, so these are exact grid lines.
    vertical.push({ at, major: k % (count / 4) === 0 });
  }

  const majors = MAJOR_FRACTIONS.map((f) => round(canvasHeight * f));
  const horizontal: GridLine[] = majors
    .filter((at) => at > 0 && at < canvasHeight)
    .map((at) => ({ at, major: true }));

  for (let k = 1; k * spacing < canvasHeight; k += 1) {
    const at = round(k * spacing);
    // A minor line that lands on a major one would double its weight.
    if (majors.some((major) => Math.abs(major - at) < 0.001)) continue;
    horizontal.push({ at, major: false });
  }

  horizontal.sort((a, b) => a.at - b.at);
  return { spacing, vertical, horizontal };
};

/**
 * The grid as snap targets.
 *
 * Every line accepts every edge: a grid line is a place to put an edge, and it
 * carries none of the leading/trailing argument that keeps a gutter honest
 * between two pieces. The canvas edges are added back here — they are not
 * drawn, but a piece flush to the top or the side is exactly what the grid is
 * for.
 */
export const gridGuides = (columns: number, canvasHeight: number): Guides => {
  const lines = gridLines(columns, canvasHeight);
  const all: Guide["edges"] = ["leading", "centre", "trailing"];

  return {
    vertical: collapse([
      { at: 0, edges: all },
      { at: 100, edges: all },
      ...lines.vertical.map((line) => ({ at: line.at, edges: all })),
    ]),
    horizontal: collapse([
      { at: 0, edges: all },
      { at: round(canvasHeight), edges: all },
      ...lines.horizontal.map((line) => ({ at: line.at, edges: all })),
    ]),
  };
};
