"use client";

import { memo, useMemo } from "react";
import { gridLines } from "@/lib/grid";

/**
 * The alignment grid, drawn over the editor's canvas.
 *
 * One absolutely positioned div per line, at a percentage offset — the same
 * positioning every element on this canvas already uses, so there is no
 * question about what the percentage is measured against. The line itself is a
 * repeating gradient rather than a dashed border; see `.wall-rule-v` in
 * globals.css for why, on both counts.
 */
function Grid({
  columns,
  ratio,
}: {
  columns: number;
  /** The canvas height as a percentage of its width. */
  ratio: number;
}) {
  const lines = useMemo(() => gridLines(columns, ratio), [columns, ratio]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {lines.vertical.map((line) => (
        <div
          key={`v${line.at}`}
          className={`wall-rule-v absolute top-0 bottom-0 ${
            // The heavier line straddles its position rather than starting at it.
            line.major ? "wall-rule-major -translate-x-px" : ""
          }`}
          style={{ left: `${line.at}%` }}
        />
      ))}
      {lines.horizontal.map((line) => (
        <div
          key={`h${line.at}`}
          className="wall-rule-h absolute right-0 left-0"
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
 * is how the piece being dragged follows the pointer. The grid is dozens of
 * nodes that cannot have changed, because its height comes from the committed
 * positions rather than the live one, so without this it was reconciled from
 * scratch on every frame of every gesture.
 */
export const WallGrid = memo(Grid);
