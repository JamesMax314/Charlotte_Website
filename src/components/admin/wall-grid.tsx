"use client";

import { memo, useMemo } from "react";
import { gridLines, resolveGridColumns } from "@/lib/grid";

/** Custom properties are not in React's CSSProperties type. */
type GridVars = React.CSSProperties & Record<`--${string}`, string>;

/**
 * The alignment grid, drawn over the editor's canvas.
 *
 * Five elements whatever the spacing: one repeating gradient for the columns,
 * one for the rows, and a div apiece for the three emphasised lines. See
 * `.wall-grid-columns` in globals.css for why it is not one element per line,
 * which is what it was and what made scrolling the editor crawl.
 */
function Grid({
  columns,
  ratio,
}: {
  columns: number;
  /** The canvas height as a percentage of its width. */
  ratio: number;
}) {
  // One spacing drives both axes. The wall measures everything in canvas-width
  // percent, so the rows convert through the height ratio to stay square.
  const across = 100 / resolveGridColumns(columns);
  const down = (across / ratio) * 100;

  // The 25%, 50% and 75% lines. Taken from the same geometry the snapping uses
  // rather than written out again, so the heavy lines cannot drift from it.
  const majors = useMemo(
    () => gridLines(columns, ratio).vertical.filter((line) => line.major),
    [columns, ratio],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div
        className="wall-grid-columns absolute inset-0"
        style={{ "--wall-grid-cell": `${across}%` } as GridVars}
      />
      <div
        className="wall-grid-rows absolute inset-0"
        style={{ "--wall-grid-cell": `${down}%` } as GridVars}
      />
      {majors.map((line) => (
        <div
          key={line.at}
          // Straddles its position rather than starting at it.
          className="wall-grid-major absolute top-0 bottom-0 -translate-x-px"
          style={{ left: `${line.at}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Memoised, and that is not an optimisation to be tidied away later.
 *
 * The canvas re-renders on every pointermove of a drag — it has to, since that
 * is how the piece being dragged follows the pointer. The grid cannot have
 * changed, because its height comes from the committed positions rather than
 * the live one, so without this it was reconciled on every frame of every
 * gesture.
 */
export const WallGrid = memo(Grid);
