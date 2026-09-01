/**
 * Searching the shop, as pure functions.
 *
 * The catalogue is under fifty pieces, so the whole of it is sent to the
 * browser once and narrowed there — no query parameters, no second round trip
 * to D1 on every keystroke. Kept free of database imports for the same reason
 * as src/lib/portfolio.ts: the browser has to be able to import it.
 */

import type { Artwork } from "./artworks";

/** Case- and accent-insensitive, so "giclee" finds "giclée". */
const normalise = (value: string): string =>
  value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * What a piece can be found by.
 *
 * The product type is the artist's own words rather than a fixed set, so it
 * belongs in the haystack: typing "linocut" should find the linocuts whether
 * she wrote that in the title, the medium or the type.
 */
const haystack = (artwork: Artwork): string =>
  normalise(
    [artwork.title, artwork.medium, artwork.description, artwork.listings[0]?.label ?? ""].join(
      " ",
    ),
  );

export const matchesQuery = (artwork: Artwork, query: string): boolean => {
  const needle = normalise(query);
  if (needle === "") return true;
  return haystack(artwork).includes(needle);
};

export const searchArtworks = (artworks: Artwork[], query: string): Artwork[] =>
  artworks.filter((artwork) => matchesQuery(artwork, query));
