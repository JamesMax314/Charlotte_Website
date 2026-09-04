/**
 * Splits an array into groups of at most `size`.
 *
 * Exists for D1's own sake: a multi-row `INSERT ... VALUES (...), (...), ...`
 * binds one parameter per column per row, and D1 caps a single statement at
 * 100 bound parameters (https://developers.cloudflare.com/d1/platform/limits/)
 * — a limit plain SQLite does not have, so nothing local catches a query that
 * exceeds it. A handful of rows is invisible; a piece whose own page holds a
 * modest gallery of ten-odd images is not, and the failure reaches the artist
 * as a redacted React error naming neither the query nor the limit.
 */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  if (size <= 0) throw new Error("chunk size must be positive");
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
};

/** D1's documented ceiling. Never raise this to match a higher limit without checking the docs. */
export const D1_MAX_BOUND_PARAMETERS = 100;

/** How many rows of a table with `columns` columns fit under D1's parameter cap in one insert. */
export const maxRowsPerInsert = (columns: number): number =>
  Math.max(1, Math.floor(D1_MAX_BOUND_PARAMETERS / columns));
