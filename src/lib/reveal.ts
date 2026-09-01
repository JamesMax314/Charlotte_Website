/**
 * Timing and geometry for the on-load fade.
 *
 * Pure so it can be tested directly: the browser measurements this feature
 * needs have proved unreliable to instrument.
 */

/** Long enough that the hidden state is painted before anything reveals it. */
export const FIRST_PAINT_DELAY_MS = 80;

/** Spread across the pieces already on screen, top to bottom. */
export const STAGGER_WINDOW_MS = 450;

/**
 * How far up the viewport a piece must reach to be revealed, as a share of the
 * viewport height. A little short of the fold, so a piece is already arriving
 * as it enters rather than popping in once fully visible.
 */
export const REVEAL_BAND = 0.92;

/** Once revealed, how long before the transition is finished with. */
export const SETTLE_MS = 900;

/**
 * How often the reveal re-measures regardless of events.
 *
 * Scroll and resize cover the ordinary cases; this covers the ones no event
 * announces, such as a late web font reflowing the wall beneath the fold.
 */
export const POLL_INTERVAL_MS = 500;

/**
 * When a piece already on screen at load should begin to fade in.
 *
 * Ordered by vertical position, so the wall assembles from the top down rather
 * than every piece arriving at once. A piece at the top of the viewport waits
 * only for the first paint; one at the fold waits the full window.
 */
export const revealDelay = (
  topInViewport: number,
  viewportHeight: number,
  { firstPaint = FIRST_PAINT_DELAY_MS, stagger = STAGGER_WINDOW_MS } = {},
): number => {
  if (viewportHeight <= 0) return firstPaint;

  // Anything above the fold clamps to the start; nothing waits longer than the
  // window, however far down the page it sits.
  const ratio = Math.min(Math.max(topInViewport / viewportHeight, 0), 1);
  return Math.round(firstPaint + ratio * stagger);
};

/** Whether a piece is on screen when the page loads. */
export const isOnScreenAtLoad = (
  rect: { top: number; bottom: number },
  viewportHeight: number,
): boolean => rect.top < viewportHeight && rect.bottom > 0;

/**
 * Whether a piece has risen far enough into the viewport to be revealed.
 *
 * The height floor matters more than it looks. A piece is measured before its
 * image has loaded, when it can still be zero-high — and a zero-high box has
 * `bottom === top`, so a plain `bottom > 0` test rejects every piece sitting
 * exactly at the top of the document and strands it permanently.
 */
export const isWithinRevealBand = (
  rect: { top: number; height: number },
  viewportHeight: number,
  band = REVEAL_BAND,
): boolean => rect.top < viewportHeight * band && rect.top + Math.max(rect.height, 1) > 0;
