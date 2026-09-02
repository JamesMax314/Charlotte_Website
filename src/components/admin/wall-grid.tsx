"use client";

import { memo, useMemo } from "react";
import { gridLines } from "@/lib/grid";

/**
 * The alignment grid, drawn over the editor's canvas.
 *
 * Absolutely positioned divs with a dashed border, which is the same thing the
 * marquee and the drop indicator on this canvas are already made of, and the
 * same percentage positioning every wall element uses. The first attempt drew
 * an SVG with percentage coordinates and no viewBox, which paints in Chrome
 * and nowhere else worth relying on: without a viewBox an inline SVG has no
 * intrinsic viewport, so what a percentage is a percentage *of* is exactly the
 * thing browsers disagree about. A div positioned at `left: 25%` has no such
 * question to answer.
 *
 * Weight, not colour, separates a major line from a minor one — both are the
 * plain `line` token. The SVG version reached for `stroke-line/70`, which
 * Tailwind compiles to `color-mix()`; an engine that does not support it drops
 * the whole declaration and paints no line at all, which is a silent and total
 * failure for a decorative colour that only needed to be lighter.
 */
function Grid({
  columns,
  ratio,
}: {
  columns: number;
  /** The canvas height as a percentage of its width. */
  ratio: number;
}) {
  // The wall is measured in canvas-width percent on both axes; the canvas is a
  // box of a fixed aspect. Dividing by the ratio is the same conversion every
  // element on this canvas does to its `top`.
  const lines = useMemo(() => gridLines(columns, ratio), [columns, ratio]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {lines.vertical.map((line) => (
        <div
          key={`v${line.at}`}
          className={`border-line absolute top-0 bottom-0 border-dashed ${
            // The thick line straddles its position rather than starting at it.
            line.major ? "-translate-x-px border-l-2" : "border-l"
          }`}
          style={{ left: `${line.at}%` }}
        />
      ))}
      {lines.horizontal.map((line) => (
        <div
          key={`h${line.at}`}
          className={`border-line absolute right-0 left-0 border-dashed ${
            line.major ? "-translate-y-px border-t-2" : "border-t"
          }`}
          style={{ top: `${(line.at / ratio) * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Memoised, and that is not an optimisation to be tidied away later.
 *
 * The canvas re-renders on every pointermove of a drag — it has to, since that
 * is how the piece being dragged follows the pointer. The grid is a hundred
 * nodes that cannot have changed, because its height comes from the committed
 * positions rather than the live one, so without this it was reconciled from
 * scratch on every frame of every gesture and the whole canvas dragged like
 * treacle.
 */
export const WallGrid = memo(Grid);
