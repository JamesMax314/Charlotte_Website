import { describe, expect, it } from "vitest";
import {
  alignSelection,
  boundsOf,
  caughtBy,
  distributeSelection,
  marqueeRect,
  moveSelection,
  scaleFactorFor,
  scaleSelection,
  snapScaleFactor,
  type SelectedElement,
} from "./selection";
import { collectGuides } from "./snap";
import { WALL_LIMITS, WALL_TEXT_CQW } from "./portfolio";

const piece = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): SelectedElement => ({ kind: "item", id, x, y, width, height });

const text = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize = 2.4,
): SelectedElement => ({ kind: "text", id, x, y, width, height, fontSize });

describe("marqueeRect", () => {
  it("normalises a rectangle dragged up and to the left", () => {
    expect(marqueeRect({ x: 60, y: 40 }, { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 40,
      height: 30,
    });
  });
});

describe("caughtBy", () => {
  const wall = [piece("a", 0, 0, 20, 15), piece("b", 50, 50, 20, 15), text("c", 10, 10, 30, 6)];

  it("catches anything the rectangle touches, not only what it encloses", () => {
    // Clips the corner of "a" and nothing else — an enclosure test finds none.
    expect(caughtBy(wall, { x: 18, y: 2, width: 4, height: 3 })).toEqual(["a"]);
  });

  it("catches pieces and text alike", () => {
    expect(caughtBy(wall, { x: 0, y: 0, width: 45, height: 20 }).sort()).toEqual(["a", "c"]);
  });

  /**
   * A click on empty canvas is a zero-area marquee. Were touching to count,
   * every element under the pointer would be selected by a gesture whose whole
   * job is to clear the selection.
   */
  it("catches nothing at zero area", () => {
    expect(caughtBy(wall, { x: 10, y: 10, width: 0, height: 0 })).toEqual([]);
  });

  it("treats a shared edge as a miss", () => {
    expect(caughtBy([piece("a", 0, 0, 20, 15)], { x: 20, y: 0, width: 10, height: 10 })).toEqual(
      [],
    );
  });
});

describe("boundsOf", () => {
  it("encloses every member", () => {
    expect(boundsOf([piece("a", 10, 5, 20, 10), text("b", 50, 40, 10, 4)])).toEqual({
      x: 10,
      y: 5,
      width: 50,
      height: 39,
    });
  });

  it("is null when nothing is selected", () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe("moveSelection", () => {
  it("moves every member by the same amount", () => {
    const moved = moveSelection([piece("a", 10, 10, 20, 10), text("b", 40, 30, 10, 4)], {
      x: 5,
      y: -2,
    });
    expect(moved.map((e) => [e.x, e.y])).toEqual([
      [15, 8],
      [45, 28],
    ]);
  });

  /**
   * The group is one body. Clamping each element as it reached the top would
   * pile them up against it and destroy the arrangement the artist made.
   */
  it("stops the group when its own top reaches the wall, keeping the arrangement", () => {
    const moved = moveSelection([piece("a", 0, 4, 20, 10), piece("b", 30, 20, 20, 10)], {
      x: 0,
      y: -30,
    });
    expect(moved.map((e) => e.y)).toEqual([0, 16]);
  });
});

describe("scaleSelection", () => {
  const origin = { x: 10, y: 10 };

  it("scales sizes and the distances between members about the top-left corner", () => {
    const scaled = scaleSelection(
      [piece("a", 10, 10, 20, 10), piece("b", 40, 30, 10, 5)],
      origin,
      2,
    );
    expect(scaled[0]).toMatchObject({ x: 10, y: 10, width: 40, height: 20 });
    expect(scaled[1]).toMatchObject({ x: 70, y: 50, width: 20, height: 10 });
  });

  it("scales a text box's type with its box", () => {
    const [scaled] = scaleSelection([text("t", 10, 10, 20, 8, 3)], origin, 1.5);
    expect(scaled.fontSize).toBeCloseTo(4.5);
    expect(scaled.height).toBeCloseTo(12);
  });

  /** A piece's height is its cover image's, and a scale must not distort it. */
  it("keeps a piece's aspect ratio when its width is clamped", () => {
    const [scaled] = scaleSelection([piece("a", 10, 10, 100, 50)], origin, 4);
    expect(scaled.width).toBe(WALL_LIMITS.width.max);
    expect(scaled.height).toBeCloseTo(WALL_LIMITS.width.max / 2);
  });

  it("holds type inside the size the wall allows", () => {
    const [scaled] = scaleSelection([text("t", 10, 10, 20, 8, 15)], origin, 4);
    expect(scaled.fontSize).toBe(WALL_TEXT_CQW.max);
  });

  /**
   * Every frame is computed from the sizes the gesture started at, so an
   * element that clamps on the way down is exactly itself again on the way
   * back up. Were it incremental, a scale down and back would shrink the group
   * permanently.
   */
  it("recovers a clamped member when the factor comes back", () => {
    const start = [text("t", 10, 10, 20, 8, 0.6), piece("a", 40, 10, 30, 20)];
    const shrunk = scaleSelection(start, origin, 0.1);
    expect(shrunk[0].fontSize).toBe(WALL_TEXT_CQW.min);

    expect(scaleSelection(start, origin, 1)).toEqual(start);
  });
});

describe("scaleFactorFor", () => {
  const bounds = { x: 0, y: 0, width: 40, height: 20 };

  it("follows width when the pointer moved further across", () => {
    expect(scaleFactorFor(bounds, { x: 20, y: 1 })).toBeCloseTo(1.5);
  });

  /** Otherwise the handle feels dead when dragged down a tall, narrow group. */
  it("follows height when the pointer moved further down", () => {
    expect(scaleFactorFor(bounds, { x: 1, y: 20 })).toBeCloseTo(2);
  });

  it("never scales a group away to nothing", () => {
    expect(scaleFactorFor(bounds, { x: -80, y: -80 })).toBeGreaterThan(0);
  });
});

describe("snapScaleFactor", () => {
  const bounds = { x: 0, y: 0, width: 40, height: 20 };

  it("snaps the group's trailing edge to a neighbour's", () => {
    // A piece whose right edge sits at 60, so the group wants a factor of 1.5.
    const guides = collectGuides([{ x: 40, y: 80, width: 20, height: 10 }], 200);
    const result = snapScaleFactor(bounds, 1.49, guides);
    expect(result.factor).toBeCloseTo(1.5);
    expect(result.vertical).toBeCloseTo(60);
  });

  it("leaves a factor alone when nothing is near", () => {
    const guides = collectGuides([{ x: 90, y: 150, width: 5, height: 5 }], 200);
    expect(snapScaleFactor(bounds, 1.2, guides).factor).toBeCloseTo(1.2);
  });

  /**
   * The same rule `snapResize` follows: a corner drag moves only the trailing
   * edges, so a guide that accepts only a leading edge must not catch it. With
   * a gutter set, this is what stops a group resting flush on its neighbour.
   */
  it("ignores guides that only accept a leading edge", () => {
    const guides = collectGuides([{ x: 20, y: 80, width: 20, height: 10 }], 200, 4);
    // 64 is the neighbour's right edge plus the gutter: leading edges only.
    const result = snapScaleFactor({ x: 0, y: 0, width: 40, height: 20 }, 1.6, guides);
    expect(result.vertical).not.toBe(64);
  });
});

describe("alignSelection", () => {
  const two = [piece("a", 10, 10, 20, 10), piece("b", 50, 40, 10, 5)];

  it("aligns to the selection's own box", () => {
    expect(alignSelection(two, "left").map((e) => e.x)).toEqual([10, 10]);
    expect(alignSelection(two, "right").map((e) => e.x)).toEqual([40, 50]);
    expect(alignSelection(two, "top").map((e) => e.y)).toEqual([10, 10]);
  });

  it("centres each element in the box rather than lining up their edges", () => {
    // The box spans 10 to 60, so its centre is 35.
    expect(alignSelection(two, "centre-x").map((e) => e.x + e.width / 2)).toEqual([35, 35]);
  });

  it("does nothing to a single element", () => {
    const one = [piece("a", 10, 10, 20, 10)];
    expect(alignSelection(one, "left")).toEqual(one);
  });
});

describe("distributeSelection", () => {
  /**
   * Equal gaps, not equal centres: with elements of different widths the two
   * are different arrangements, and the artist is looking at the white space.
   */
  it("leaves equal gaps between neighbours of unequal size", () => {
    const spread = distributeSelection(
      [piece("a", 0, 0, 10, 10), piece("b", 30, 0, 30, 10), piece("c", 90, 0, 10, 10)],
      "horizontal",
    );
    const byId = Object.fromEntries(spread.map((e) => [e.id, e]));
    const first = byId.b.x - (byId.a.x + byId.a.width);
    const second = byId.c.x - (byId.b.x + byId.b.width);
    expect(first).toBeCloseTo(second);
  });

  it("never moves the outermost two", () => {
    const spread = distributeSelection(
      [piece("a", 0, 0, 10, 10), piece("b", 20, 0, 10, 10), piece("c", 90, 0, 10, 10)],
      "horizontal",
    );
    const byId = Object.fromEntries(spread.map((e) => [e.id, e]));
    expect(byId.a.x).toBeCloseTo(0);
    expect(byId.c.x).toBeCloseTo(90);
  });

  it("works down the wall as well as across it", () => {
    const spread = distributeSelection(
      [piece("a", 0, 0, 10, 10), piece("b", 0, 15, 10, 10), piece("c", 0, 100, 10, 10)],
      "vertical",
    );
    const byId = Object.fromEntries(spread.map((e) => [e.id, e]));
    expect(byId.b.y).toBeCloseTo(50);
  });

  it("needs three to mean anything", () => {
    const two = [piece("a", 0, 0, 10, 10), piece("b", 50, 0, 10, 10)];
    expect(distributeSelection(two, "horizontal")).toEqual(two);
  });
});
