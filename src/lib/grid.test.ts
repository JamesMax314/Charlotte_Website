import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRID_COLUMNS,
  GRID_COLUMN_CHOICES,
  gridGuides,
  gridLines,
  resolveGridColumns,
} from "./grid";
import { collectGuides, mergeGuides, snapMove, type Guides } from "./snap";

const at = (lines: { at: number; major: boolean }[], position: number) =>
  lines.find((line) => Math.abs(line.at - position) < 0.001) ?? null;

describe("gridLines", () => {
  it("divides the width into the columns asked for", () => {
    const { spacing, vertical } = gridLines(4, 100);
    expect(spacing).toBe(25);
    // Interior lines only: the canvas draws its own border at 0 and 100.
    expect(vertical.map((line) => line.at)).toEqual([25, 50, 75]);
  });

  it("draws the quarters and the centre heavier, across the width", () => {
    const { vertical } = gridLines(12, 100);
    expect(at(vertical, 25)?.major).toBe(true);
    expect(at(vertical, 50)?.major).toBe(true);
    expect(at(vertical, 75)?.major).toBe(true);
    expect(at(vertical, 100 / 12)?.major).toBe(false);
  });

  /**
   * The reason the dropdown offers columns rather than a percentage. Every
   * choice divides by four, so the emphasised lines are always real grid
   * lines rather than lines drawn between them.
   */
  it("puts the quarters on a grid line at every spacing on offer", () => {
    for (const columns of GRID_COLUMN_CHOICES) {
      const { vertical } = gridLines(columns, 100);
      for (const quarter of [25, 50, 75]) {
        expect(at(vertical, quarter)?.major, `${columns} columns`).toBe(true);
      }
    }
  });

  it("spaces the rows exactly as it spaces the columns, so the cells are square", () => {
    // Both axes are canvas-width percent, so one number governs both.
    const { spacing, horizontal } = gridLines(8, 60);
    const minors = horizontal.filter((line) => !line.major).map((line) => line.at);
    expect(spacing).toBe(12.5);
    expect(minors).toContain(12.5);
    expect(minors).toContain(25);
    expect(minors).toContain(37.5);
  });

  it("takes the horizontal quarters of the wall's height, which is not a fixed span", () => {
    const { horizontal } = gridLines(12, 80);
    expect(at(horizontal, 20)?.major).toBe(true);
    expect(at(horizontal, 40)?.major).toBe(true);
    expect(at(horizontal, 60)?.major).toBe(true);
  });

  it("draws no line past the bottom of the wall", () => {
    const { horizontal } = gridLines(4, 40);
    expect(horizontal.every((line) => line.at < 40)).toBe(true);
  });

  it("never doubles a minor line onto a major one", () => {
    // 4 columns is 25 apart, and a height of 100 puts the quarters at 25 too.
    const { horizontal } = gridLines(4, 100);
    expect(horizontal.filter((line) => Math.abs(line.at - 25) < 0.001)).toHaveLength(1);
    expect(at(horizontal, 25)?.major).toBe(true);
  });

  it("returns the lines in order down the wall, majors interleaved", () => {
    const { horizontal } = gridLines(12, 90);
    const positions = horizontal.map((line) => line.at);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe("resolveGridColumns", () => {
  it("keeps a count off the list", () => {
    expect(resolveGridColumns(16)).toBe(16);
  });

  it("falls back rather than trusting a count from a form or an old row", () => {
    expect(resolveGridColumns(7)).toBe(DEFAULT_GRID_COLUMNS);
    expect(resolveGridColumns(0)).toBe(DEFAULT_GRID_COLUMNS);
    expect(resolveGridColumns(Number.NaN)).toBe(DEFAULT_GRID_COLUMNS);
  });
});

describe("gridGuides", () => {
  const edgesAt = (guides: Guides, axis: "vertical" | "horizontal", position: number) =>
    guides[axis].find((g) => Math.abs(g.at - position) < 0.001)?.edges ?? null;

  it("lets any edge reach a grid line, unlike a neighbour's edge", () => {
    const guides = gridGuides(4, 100);
    expect(edgesAt(guides, "vertical", 25)).toEqual(
      expect.arrayContaining(["leading", "centre", "trailing"]),
    );
  });

  it("puts the canvas edges back, though they are never drawn", () => {
    const guides = gridGuides(4, 60);
    expect(edgesAt(guides, "vertical", 0)).not.toBeNull();
    expect(edgesAt(guides, "vertical", 100)).not.toBeNull();
    expect(edgesAt(guides, "horizontal", 0)).not.toBeNull();
    expect(edgesAt(guides, "horizontal", 60)).not.toBeNull();
  });
});

/**
 * The two kinds of snapping are merged into one set of guides rather than
 * tried in turn, so neither has to defer to the other.
 */
describe("the grid alongside edge snapping", () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const neighbour = { x: 26, y: 0, width: 20, height: 10 };

  it("takes the neighbour's edge when it is the nearer of the two", () => {
    const guides = mergeGuides(collectGuides([neighbour], 100, 0), gridGuides(4, 100));
    // Left edge at 26.4: the neighbour's edge is 0.4 away, the grid line 1.4.
    expect(snapMove({ ...box, x: 26.4 }, guides).x).toBeCloseTo(26);
  });

  it("takes the grid line when that is the nearer", () => {
    const guides = mergeGuides(collectGuides([neighbour], 100, 0), gridGuides(4, 100));
    // Left edge at 25.2: the grid line is 0.2 away, the neighbour's edge 0.8.
    expect(snapMove({ ...box, x: 25.2 }, guides).x).toBeCloseTo(25);
  });

  it("snaps to the grid alone when edge snapping is off", () => {
    const guides = gridGuides(4, 100);
    expect(snapMove({ ...box, x: 25.8 }, guides).x).toBeCloseTo(25);
  });

  /**
   * The grid does not make the threshold any wider. A piece dropped mid-cell
   * stays where it was put — the artist is still placing work by hand.
   */
  it("leaves a piece between two grid lines alone", () => {
    const guides = gridGuides(4, 100);
    expect(snapMove({ ...box, x: 26.4 }, guides).x).toBe(26.4);
  });

  it("leaves a piece alone when neither has anything within reach", () => {
    const guides = gridGuides(4, 100);
    expect(snapMove({ ...box, x: 12 }, guides).x).toBe(12);
  });
});
