/**
 * Page copy, as the artist types it.
 *
 * She writes into a plain textarea, so the only structure available is the
 * blank line. Everything here is pure: the pages and the admin preview both
 * split the same way.
 */

/**
 * Splits copy into paragraphs on blank lines.
 *
 * A single newline is kept inside its paragraph rather than starting a new
 * one — she is typing in a plain box and will expect Enter to do something.
 * Render the result with `whitespace-pre-line`, as the wall already renders
 * its text `whitespace-pre-wrap`.
 */
export const toParagraphs = (copy: string): string[] =>
  copy
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
