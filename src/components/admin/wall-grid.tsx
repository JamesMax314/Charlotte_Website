"use client";

import { gridLines } from "@/lib/grid";

/**
 * The alignment grid, drawn over the editor's canvas.
 *
 * An SVG rather than a stack of bordered divs so the dashes are real strokes:
 * a border-dashed div gives no control over the dash, and a repeating gradient
 * cannot draw a heavier line every fourth row without a second layer.
 *
 * Positions are percentages of the SVG's own box, which is the canvas, so the
 * grid needs no pixel measurements and survives the canvas being resized. The
 * horizontal axis is stored in canvas-width percent like everything else on
 * the wall, so it is divided by the height ratio on the way out — exactly as
 * the elements themselves are.
 */
export function WallGrid({
  columns,
  ratio,
}: {
  columns: number;
  /** The canvas height as a percentage of its width. */
  ratio: number;
}) {
  const lines = gridLines(columns, ratio);

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      // Percentage coordinates resolve against the rendered box, so no viewBox
      // is wanted here: one would scale the strokes and the dashes with it.
    >
      {lines.vertical.map((line) => (
        <line
          key={`v${line.at}`}
          x1={`${line.at}%`}
          x2={`${line.at}%`}
          y1="0"
          y2="100%"
          className={line.major ? "stroke-line" : "stroke-line/70"}
          strokeWidth={line.major ? 2 : 1}
          strokeDasharray={line.major ? "6 4" : "3 4"}
        />
      ))}
      {lines.horizontal.map((line) => (
        <line
          key={`h${line.at}`}
          x1="0"
          x2="100%"
          y1={`${(line.at / ratio) * 100}%`}
          y2={`${(line.at / ratio) * 100}%`}
          className={line.major ? "stroke-line" : "stroke-line/70"}
          strokeWidth={line.major ? 2 : 1}
          strokeDasharray={line.major ? "6 4" : "3 4"}
        />
      ))}
    </svg>
  );
}
