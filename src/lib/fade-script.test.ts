import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fadeScript } from "./fade-script";
import { FIRST_PAINT_DELAY_MS, POLL_INTERVAL_MS, SETTLE_MS, STAGGER_WINDOW_MS } from "./reveal";

/**
 * The reveal, exercised against a real DOM.
 *
 * The pure timing helpers in `reveal.ts` were tested and correct while the
 * feature was broken three times running: the reveal never arrived on a phone,
 * then arrived only above the fold, then stopped arriving on scroll. Every one
 * of those was in the wiring rather than the arithmetic, so the wiring is what
 * these cover.
 */

const VIEWPORT = 800;
const PIECE = 600;

/** A stack of pieces, measured against a scroll position the test controls. */
function buildWall(count: number) {
  document.body.innerHTML = "";
  let scrollY = 0;

  const pieces = Array.from({ length: count }, (_, i) => {
    const el = document.createElement("div");
    el.className = "fade-target";
    el.getBoundingClientRect = () =>
      ({ top: i * PIECE - scrollY, height: PIECE, bottom: i * PIECE - scrollY + PIECE }) as DOMRect;
    document.body.appendChild(el);
    return el;
  });

  return {
    pieces,
    visible: () => pieces.filter((el) => el.classList.contains("is-visible")).length,
    scrollTo(y: number) {
      scrollY = y;
      window.dispatchEvent(new Event("scroll"));
    },
    /** Moves the wall under the viewport without announcing it. */
    grow(y: number) {
      scrollY = y;
    },
  };
}

const run = () => new Function(fadeScript)();

/** Long enough for the opening stagger and every settle to have run. */
const settleEverything = () =>
  vi.advanceTimersByTime(FIRST_PAINT_DELAY_MS + STAGGER_WINDOW_MS + SETTLE_MS + 100);

/**
 * Just enough for one throttled pass, and far short of the poll.
 *
 * Every assertion about an event must advance by this rather than by anything
 * larger: the script also re-measures on an interval, so a generous advance
 * reveals the piece regardless and the test passes with the listener deleted.
 * That is not hypothetical — the first version of this file did exactly that.
 */
const TICK = 20;

beforeEach(() => {
  vi.useFakeTimers();
  // Deterministic: the script throttles through rAF, so drive it from a timer.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(0), 0) as unknown as number;
  });
  vi.stubGlobal("innerHeight", VIEWPORT);
  document.documentElement.className = "";
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the fade script", () => {
  it("hides the page immediately, before anything is measured", () => {
    run();
    expect(document.documentElement).toHaveClass("js-fade");
  });

  it("reveals the opening screenful without any bundle having loaded", () => {
    const wall = buildWall(6);
    run();
    settleEverything();

    // Two pieces fit in an 800px viewport at 600px each; the band trims the
    // second, so at least the first is revealed and the far ones are not.
    expect(wall.visible()).toBeGreaterThan(0);
    expect(wall.pieces[0]).toHaveClass("is-visible");
    expect(wall.pieces[5]).not.toHaveClass("is-visible");
  });

  it("reveals pieces below the fold when the visitor scrolls", () => {
    const wall = buildWall(6);
    run();
    settleEverything();
    expect(wall.pieces[5]).not.toHaveClass("is-visible");

    wall.scrollTo(PIECE * 4);
    vi.advanceTimersByTime(TICK);

    expect(wall.pieces[5]).toHaveClass("is-visible");
  });

  it("reveals a piece when its image arrives, with no scroll at all", () => {
    // Images loading reflow everything beneath them and fire no scroll event.
    const wall = buildWall(6);
    run();
    settleEverything();

    wall.grow(PIECE * 4);
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(TICK);

    expect(wall.pieces[5]).toHaveClass("is-visible");
  });

  it("re-measures on a timer when nothing fires an event at all", () => {
    // The backstop for reflows no event announces, such as a late web font.
    const wall = buildWall(6);
    run();
    settleEverything();

    wall.grow(PIECE * 4);
    vi.advanceTimersByTime(POLL_INTERVAL_MS + TICK);

    expect(wall.pieces[5]).toHaveClass("is-visible");
  });

  it("retires the transition after revealing, so nothing lingers on a layer", () => {
    const wall = buildWall(2);
    run();
    settleEverything();

    expect(wall.pieces[0]).toHaveClass("is-settled");
  });

  it("does not dump the rest of the wall in once the net's deadline passes", () => {
    // The net must distinguish "the reveal never started" from "the visitor has
    // not scrolled yet". Revealing on the deadline would flatten the feature
    // into a five-second delay, which is what it looked like from a phone.
    const wall = buildWall(6);
    run();
    settleEverything();
    expect(wall.pieces[0]).toHaveClass("is-visible");

    vi.advanceTimersByTime(6000);

    expect(document.documentElement).toHaveClass("js-fade");
    expect(wall.pieces[5]).not.toHaveClass("is-visible");
  });

  it("unhides everything if no pass ever runs", () => {
    buildWall(3);
    // readyState stuck at loading and DOMContentLoaded never fired: the reveal
    // cannot start, which is precisely when content must not stay hidden.
    const readyState = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");

    run();
    vi.advanceTimersByTime(6000);

    expect(document.documentElement).not.toHaveClass("js-fade");
    readyState.mockRestore();
  });

  it("reveals a piece that is measured before its image has given it height", () => {
    // A zero-high box has bottom === top, so a plain `bottom > 0` test rejects
    // anything sitting exactly at the top of the document, permanently.
    document.body.innerHTML = "";
    const el = document.createElement("div");
    el.className = "fade-target";
    el.getBoundingClientRect = () => ({ top: 0, height: 0, bottom: 0 }) as DOMRect;
    document.body.appendChild(el);

    run();
    settleEverything();

    expect(el).toHaveClass("is-visible");
  });
});
