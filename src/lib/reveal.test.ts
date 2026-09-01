import { describe, expect, it } from "vitest";
import { FIRST_PAINT_DELAY_MS, STAGGER_WINDOW_MS, isOnScreenAtLoad, revealDelay } from "./reveal";

describe("revealDelay", () => {
  it("never fires immediately, so the hidden state is painted first", () => {
    expect(revealDelay(0, 1000)).toBeGreaterThanOrEqual(FIRST_PAINT_DELAY_MS);
  });

  it("orders by vertical position, so the wall assembles from the top down", () => {
    const top = revealDelay(0, 1000);
    const middle = revealDelay(500, 1000);
    const fold = revealDelay(1000, 1000);
    expect(top).toBeLessThan(middle);
    expect(middle).toBeLessThan(fold);
  });

  it("caps the wait for anything at or beyond the fold", () => {
    const atFold = revealDelay(1000, 1000);
    expect(revealDelay(5000, 1000)).toBe(atFold);
    expect(atFold).toBe(FIRST_PAINT_DELAY_MS + STAGGER_WINDOW_MS);
  });

  it("treats a piece scrolled partly above the viewport as first in line", () => {
    expect(revealDelay(-300, 1000)).toBe(FIRST_PAINT_DELAY_MS);
  });

  it("survives a viewport height of zero rather than dividing by it", () => {
    expect(revealDelay(100, 0)).toBe(FIRST_PAINT_DELAY_MS);
  });
});

describe("isOnScreenAtLoad", () => {
  it("recognises a piece within the fold", () => {
    expect(isOnScreenAtLoad({ top: 200, bottom: 700 }, 1000)).toBe(true);
  });

  it("recognises one straddling the top of the viewport", () => {
    expect(isOnScreenAtLoad({ top: -50, bottom: 300 }, 1000)).toBe(true);
  });

  it("rejects one below the fold, which the scroll observer handles instead", () => {
    expect(isOnScreenAtLoad({ top: 1400, bottom: 1900 }, 1000)).toBe(false);
  });

  /**
   * The mobile branch is display:none on a wide screen, so its boxes measure
   * zero. Those must fall to the observer, not reveal on a timer.
   */
  it("rejects a collapsed box, as a hidden layout branch produces", () => {
    expect(isOnScreenAtLoad({ top: 0, bottom: 0 }, 1000)).toBe(false);
  });
});
