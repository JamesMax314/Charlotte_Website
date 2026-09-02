/**
 * Where a scrolling list must be scrolled to show one of its rows.
 *
 * This exists because `scrollIntoView` cannot be told where to stop. It walks
 * every scrollable ancestor of the element, so a list that sits in the normal
 * document flow — the size selector on the settings page — scrolled the whole
 * page to bring its own dropdown into view the moment it opened, which reads
 * as the page jumping out from under the artist.
 *
 * The wall never showed this and could not have: its formatting panel is
 * `position: fixed`, and a fixed element's chain of scrollable ancestors ends
 * at the viewport, so there was nothing above the list left to scroll. The
 * same call was correct in one place and wrong in the other.
 *
 * Arithmetic rather than a browser call, so the list is the only thing that
 * can move. Pure, because jsdom has no layout: every measurement here reads
 * back as zero in a component test, and the sums are the part worth proving.
 */

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high));

/** A row's offset within the list, and how tall it is. */
export interface RowBox {
  top: number;
  height: number;
}

/**
 * Puts a row in the middle of the list — how the list opens, so the size in
 * force sits under the pointer with the ladder either side of it.
 *
 * Clamped to what the list can actually scroll, so a row near either end
 * settles flush rather than leaving the list scrolled past its own content.
 */
export const centreScrollTop = (row: RowBox, viewport: number, content: number): number =>
  clamp(row.top - (viewport - row.height) / 2, 0, content - viewport);

/**
 * Moves as little as possible to bring a row fully into view — how the arrow
 * keys walk the ladder, where a jump to the centre on every keystroke would
 * make the list lurch under a held-down key.
 */
export const nearestScrollTop = (row: RowBox, viewport: number, current: number): number => {
  if (row.top < current) return row.top;
  const bottom = row.top + row.height;
  if (bottom > current + viewport) return bottom - viewport;
  return current;
};
