import { describe, expect, it } from "vitest";
import {
  collectGuides,
  rectOf,
  snapMove,
  snapResize,
  snapResizeFree,
  type Guides,
  type Rect,
} from "./snap";

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

/** The edges a guide at this position accepts, or null if there is no guide. */
const edgesAt = (guides: Guides, axis: "vertical" | "horizontal", at: number) =>
  guides[axis].find((g) => Math.abs(g.at - at) < 0.001)?.edges ?? null;

describe("collectGuides", () => {
  it("aligns like edges with like: left to left, right to right", () => {
    const guides = collectGuides([rect(40, 0, 20, 10)], 100);
    expect(edgesAt(guides, "vertical", 40)).toContain("leading");
    expect(edgesAt(guides, "vertical", 60)).toContain("trailing");
    expect(edgesAt(guides, "vertical", 50)).toContain("centre");
  });

  it("collapses abutting onto the edges when there is no gutter, so pieces butt up flush", () => {
    const guides = collectGuides([rect(40, 0, 20, 10)], 100, 0);
    // The neighbour's left edge accepts a trailing edge too: flush contact.
    expect(edgesAt(guides, "vertical", 40)).toEqual(
      expect.arrayContaining(["leading", "trailing"]),
    );
  });

  /**
   * The bug this whole edge-role scheme exists to fix: with a gap set, a piece
   * could still snap flush, because any edge could reach any guide. Pieces then
   * came to rest at a mixture of spacings.
   */
  it("refuses flush contact once a gutter is set", () => {
    const guides = collectGuides([rect(40, 0, 20, 10)], 100, 3);
    expect(edgesAt(guides, "vertical", 40)).toEqual(["leading"]);
    expect(edgesAt(guides, "vertical", 60)).toEqual(["trailing"]);
  });

  it("offers a place to sit on either side, one gutter away", () => {
    const guides = collectGuides([rect(40, 0, 20, 10)], 100, 3);
    expect(edgesAt(guides, "vertical", 37)).toEqual(["trailing"]);
    expect(edgesAt(guides, "vertical", 63)).toEqual(["leading"]);
  });

  it("applies the gutter identically on the vertical axis", () => {
    const guides = collectGuides([rect(0, 30, 20, 10)], 100, 3);
    expect(edgesAt(guides, "horizontal", 27)).toEqual(["trailing"]);
    expect(edgesAt(guides, "horizontal", 43)).toEqual(["leading"]);
  });
});

describe("snapMove", () => {
  const neighbour = rect(40, 30, 20, 10);

  it("aligns left edges", () => {
    const guides = collectGuides([neighbour], 100);
    const result = snapMove(rect(40.7, 70, 20, 10), guides);
    expect(result.x).toBe(40);
  });

  it("butts up flush when no gutter is set", () => {
    const guides = collectGuides([neighbour], 100, 0);
    // Right edge at 39.5 latches onto the neighbour's left edge at 40.
    expect(snapMove(rect(19.5, 70, 20, 10), guides).x).toBe(20);
  });

  it("leaves a gutter instead of going flush when one is set", () => {
    const guides = collectGuides([neighbour], 100, 3);
    // Approaching the neighbour's left edge (40): the piece stops with its
    // right edge at 37, three clear, rather than touching.
    const result = snapMove(rect(17.6, 70, 20, 10), guides);
    expect(result.x).toBe(17);
    expect(result.x + 20).toBe(37);
  });

  it("offers nothing at the flush position once a gutter is set", () => {
    const guides = collectGuides([neighbour], 100, 3);
    // Right edge at 39.6 would previously have latched flush onto 40.
    const result = snapMove(rect(19.6, 70, 20, 10), guides);
    expect(result.x).toBe(19.6);
    expect(result.vertical).toBeNull();
  });

  /** The reported fault: vertical spacing behaved differently from horizontal. */
  it("leaves the same gutter vertically as horizontally", () => {
    const guides = collectGuides([neighbour], 100, 3);

    const across = snapMove(rect(17.6, 70, 20, 10), guides);
    const gapAcross = neighbour.x - (across.x + 20);

    // Approaching from above: bottom edge should stop a gutter clear of the top.
    const down = snapMove(rect(70, 17.6, 20, 10), guides);
    const gapDown = neighbour.y - (down.y + 10);

    expect(gapAcross).toBeCloseTo(3);
    expect(gapDown).toBeCloseTo(3);
    expect(gapAcross).toBeCloseTo(gapDown);
  });

  it("sits below a neighbour a gutter away, not flush against it", () => {
    const guides = collectGuides([neighbour], 100, 3);
    // Neighbour spans y 30..40, so the next piece's top belongs at 43.
    const result = snapMove(rect(70, 42.6, 20, 10), guides);
    expect(result.y).toBe(43);
  });

  it("still aligns tops with a gutter set, so pieces can sit in a row", () => {
    const guides = collectGuides([neighbour], 100, 3);
    expect(snapMove(rect(70, 30.5, 20, 10), guides).y).toBe(30);
  });

  it("leaves a piece alone when nothing is within reach", () => {
    const guides = collectGuides([neighbour], 100);
    const result = snapMove(rect(75, 70, 20, 10), guides);
    expect(result.x).toBe(75);
    expect(result.vertical).toBeNull();
  });
});

describe("snapResize", () => {
  const guides = collectGuides([rect(40, 30, 20, 10)], 100);

  it("snaps the right edge to a neighbour's edge by changing width", () => {
    const result = snapResize(rect(10, 5, 29.4, 14.7), 0.5, guides);
    expect(result.width).toBeCloseTo(30);
    expect(result.vertical).toBe(40);
  });

  it("solves a bottom-edge snap back into a width, honouring aspect ratio", () => {
    const result = snapResize(rect(2, 10, 39.5, 19.75), 0.5, guides);
    expect(result.width).toBeCloseTo(40);
    expect(result.horizontal).toBe(30);
  });

  it("stops a gutter short of a neighbour rather than resizing flush", () => {
    const spaced = collectGuides([rect(40, 30, 20, 10)], 100, 3);
    // Right edge near 37, the gutter position, rather than 40.
    const result = snapResize(rect(10, 5, 26.6, 13.3), 0.5, spaced);
    expect(result.width).toBeCloseTo(27);
    expect(result.vertical).toBe(37);
  });

  it("leaves width alone when no edge is near a guide", () => {
    expect(snapResize(rect(0, 60, 25, 12.5), 0.5, guides).width).toBe(25);
  });

  it("never returns a zero or negative width", () => {
    const result = snapResize(rect(50, 5, 5, 2.5), 0.5, collectGuides([], 100));
    expect(result.width).toBeGreaterThan(0);
  });
});

describe("snapResizeFree", () => {
  const guides = collectGuides([rect(40, 30, 20, 10)], 100);

  it("snaps each axis independently", () => {
    const result = snapResizeFree(rect(10, 10, 29.6, 19.7), guides);
    expect(result.width).toBeCloseTo(30);
    expect(result.height).toBeCloseTo(20);
  });

  it("can snap one axis while leaving the other alone", () => {
    const result = snapResizeFree(rect(10, 60, 29.6, 15), guides);
    expect(result.width).toBeCloseTo(30);
    expect(result.height).toBe(15);
    expect(result.horizontal).toBeNull();
  });

  it("respects the gutter on both axes", () => {
    const spaced = collectGuides([rect(40, 30, 20, 10)], 100, 3);
    const result = snapResizeFree(rect(10, 10, 26.6, 16.6), spaced);
    expect(result.width).toBeCloseTo(27); // right edge at 37
    expect(result.height).toBeCloseTo(17); // bottom edge at 27
  });

  it("never produces a zero or negative dimension", () => {
    const result = snapResizeFree(rect(50, 50, 6, 6), guides);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});

describe("rectOf", () => {
  it("derives height from width and aspect, never storing it", () => {
    expect(rectOf({ x: 0, y: 0, width: 40 }, 0.5)).toEqual({ x: 0, y: 0, width: 40, height: 20 });
  });
});
