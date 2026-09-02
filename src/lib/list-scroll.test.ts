import { describe, expect, it } from "vitest";
import { centreScrollTop, nearestScrollTop } from "./list-scroll";

/** Seven visible rows of 27px in a 192px list, which is what the ladder is. */
const VIEWPORT = 192;
const ROW = 27;
const row = (index: number) => ({ top: index * ROW, height: ROW });
const content = (rows: number) => rows * ROW;

describe("centreScrollTop", () => {
  it("centres a row in the middle of a long list", () => {
    const scroll = centreScrollTop(row(20), VIEWPORT, content(43));
    expect(scroll + VIEWPORT / 2).toBeCloseTo(row(20).top + ROW / 2, 5);
  });

  /*
    Both ends matter more than the middle: the ladder's default sizes live near
    the bottom of it, and a negative or overrun scrollTop is silently clamped
    by the browser — which would hide the arithmetic being wrong.
  */
  it("never scrolls above the top for a row near the start", () => {
    expect(centreScrollTop(row(0), VIEWPORT, content(43))).toBe(0);
    expect(centreScrollTop(row(2), VIEWPORT, content(43))).toBe(0);
  });

  it("never scrolls past the end for a row near the finish", () => {
    const limit = content(43) - VIEWPORT;
    expect(centreScrollTop(row(42), VIEWPORT, content(43))).toBe(limit);
  });

  it("does not scroll a list shorter than its own box", () => {
    expect(centreScrollTop(row(1), VIEWPORT, content(3))).toBe(0);
  });
});

describe("nearestScrollTop", () => {
  it("leaves the list alone when the row is already in view", () => {
    expect(nearestScrollTop(row(3), VIEWPORT, 0)).toBe(0);
  });

  it("scrolls up by exactly the overshoot when the row is above", () => {
    expect(nearestScrollTop(row(2), VIEWPORT, 100)).toBe(row(2).top);
  });

  it("scrolls down by exactly the overshoot when the row is below", () => {
    const target = row(10);
    expect(nearestScrollTop(target, VIEWPORT, 0)).toBe(target.top + ROW - VIEWPORT);
  });
});
