/**
 * Timing for the on-load fade.
 *
 * Pure so it can be tested directly: the browser measurements this feature
 * needs have proved unreliable to instrument.
 */

/** Long enough that the hidden state is painted before anything reveals it. */
export const FIRST_PAINT_DELAY_MS = 80;

/** Spread across the pieces already on screen, top to bottom. */
export const STAGGER_WINDOW_MS = 450;

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
