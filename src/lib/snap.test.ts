import { describe, expect, it } from "vitest";
import { collectGuides, rectOf, snapMove, snapResize, type Rect } from "./snap";

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

describe("collectGuides", () => {
  it("offers each other piece's leading edge, centre and trailing edge", () => {
    const { vertical } = collectGuides([rect(10, 0, 20, 10)], 100);
    expect(vertical).toContain(10);
    expect(vertical).toContain(20); // centre
    expect(vertical).toContain(30); // trailing edge
  });

  it("includes the canvas edges and centre line", () => {
    const { vertical, horizontal } = collectGuides([], 140);
    expect(vertical).toEqual([0, 50, 100]);
    expect(horizontal).toEqual([0, 140]);
  });

  it("adds abutting guides a gutter away from each neighbour", () => {
    const { vertical } = collectGuides([rect(40, 0, 20, 10)], 100, 3);
    expect(vertical).toContain(37); // sit to the left, 3 apart
    expect(vertical).toContain(63); // sit to the right, 3 apart
    // Alignment guides survive: stacking pieces with flush left edges must
    // still be possible while a gutter is on.
    expect(vertical).toContain(40);
  });

  it("collapses abutting guides onto the edges when there is no gutter", () => {
    const withoutGutter = collectGuides([rect(40, 0, 20, 10)], 100, 0);
    const implicit = collectGuides([rect(40, 0, 20, 10)], 100);
    expect(withoutGutter).toEqual(implicit);
  });

  it("does not repeat a guide shared by several pieces", () => {
    const { vertical } = collectGuides([rect(10, 0, 20, 5), rect(10, 40, 20, 5)], 100);
    expect(vertical.filter((v) => v === 10)).toHaveLength(1);
  });
});

describe("snapMove", () => {
  const guides = collectGuides([rect(40, 30, 20, 10)], 100);

  it("aligns left edges when they are close", () => {
    const result = snapMove(rect(40.7, 70, 20, 10), guides);
    expect(result.x).toBe(40);
    expect(result.vertical).toBe(40);
  });

  it("aligns a trailing edge to another piece's leading edge", () => {
    // Right edge at 39.5 should latch onto the neighbour's left edge at 40.
    const result = snapMove(rect(19.5, 70, 20, 10), guides);
    expect(result.x).toBe(20);
    expect(result.vertical).toBe(40);
  });

  it("aligns top edges", () => {
    const result = snapMove(rect(5, 30.6, 20, 10), guides);
    expect(result.y).toBe(30);
    expect(result.horizontal).toBe(30);
  });

  it("leaves a piece alone when nothing is within reach", () => {
    const result = snapMove(rect(70, 70, 20, 10), guides);
    expect(result.x).toBe(70);
    expect(result.y).toBe(70);
    expect(result.vertical).toBeNull();
    expect(result.horizontal).toBeNull();
  });

  it("prefers the nearest guide when several are in range", () => {
    const crowded = collectGuides([rect(40, 0, 20, 5), rect(41, 0, 20, 5)], 100);
    expect(snapMove(rect(40.9, 70, 20, 10), crowded).x).toBe(41);
  });

  it("never changes the size of the piece being moved", () => {
    const moving = rect(40.5, 30.5, 20, 10);
    const result = snapMove(moving, guides);
    expect(moving.width).toBe(20);
    expect(result).not.toHaveProperty("width");
  });
});

describe("snapResize", () => {
  const guides = collectGuides([rect(40, 30, 20, 10)], 100);

  it("snaps the right edge to a neighbour's edge by changing width", () => {
    // Piece at x=10 with width 29.4 has its right edge at 39.4, near 40.
    const result = snapResize(rect(10, 5, 29.4, 14.7), 0.5, guides);
    expect(result.width).toBeCloseTo(30);
    expect(result.vertical).toBe(40);
  });

  it("solves a bottom-edge snap back into a width, honouring aspect ratio", () => {
    // x=2 keeps the right edge (41.5) clear of every vertical guide, so only
    // the bottom edge is in play. aspect 0.5, y=10, so bottom reaches the
    // guide at 30 exactly when width is 40.
    const result = snapResize(rect(2, 10, 39.5, 19.75), 0.5, guides);
    expect(result.width).toBeCloseTo(40);
    expect(result.horizontal).toBe(30);
    expect(result.vertical).toBeNull();
  });

  it("takes whichever edge needs the smaller change when both are in range", () => {
    // Right edge is 0.2 away from 40; bottom edge is 0.9 away from 30, which
    // costs 1.8 of width at aspect 0.5. The cheaper vertical snap should win.
    const result = snapResize(rect(10, 10, 29.8, 14.9), 0.5, guides);
    expect(result.vertical).toBe(40);
    expect(result.horizontal).toBeNull();
  });

  it("leaves width alone when no edge is near a guide", () => {
    const result = snapResize(rect(0, 60, 25, 12.5), 0.5, guides);
    expect(result.width).toBe(25);
    expect(result.vertical).toBeNull();
  });

  it("never returns a zero or negative width", () => {
    // A guide behind the piece's own left edge must not invert it.
    const result = snapResize(rect(50, 5, 5, 2.5), 0.5, collectGuides([], 100));
    expect(result.width).toBeGreaterThan(0);
  });
});

describe("rectOf", () => {
  it("derives height from width and aspect, never storing it", () => {
    expect(rectOf({ x: 0, y: 0, width: 40 }, 0.5)).toEqual({ x: 0, y: 0, width: 40, height: 20 });
  });
});
