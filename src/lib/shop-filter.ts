/**
 * Filtering and searching the shop, as pure functions.
 *
 * The catalogue is under fifty pieces, so the whole of it is sent to the
 * browser once and narrowed there — no query parameters, no second round trip
 * to D1 on every keystroke. Kept free of database imports for the same reason
 * as src/lib/portfolio.ts: the browser has to be able to import it.
 */

import { soleListing, type Artwork, type ListingKind } from "./artworks";

export interface ShopFilter {
  query: string;
  /** Empty means every type. */
  kinds: ListingKind[];
  minPence: number;
  maxPence: number;
}

export interface PriceBounds {
  minPence: number;
  maxPence: number;
}

/**
 * The range the price control spans: the cheapest and dearest thing for sale.
 *
 * An empty shop collapses to zero rather than to Infinity, so the slider has
 * something coherent to render before the artist has listed anything.
 */
export const priceBounds = (artworks: Artwork[]): PriceBounds => {
  const prices = artworks
    .map((artwork) => soleListing(artwork)?.pricePence)
    .filter((pence): pence is number => pence !== undefined);

  if (prices.length === 0) return { minPence: 0, maxPence: 0 };
  return { minPence: Math.min(...prices), maxPence: Math.max(...prices) };
};

/** Every piece, nothing narrowed. */
export const defaultFilter = (bounds: PriceBounds): ShopFilter => ({
  query: "",
  kinds: [],
  minPence: bounds.minPence,
  maxPence: bounds.maxPence,
});

/** True while the visitor has narrowed nothing — what hides the Clear button. */
export const isDefaultFilter = (filter: ShopFilter, bounds: PriceBounds): boolean =>
  filter.query.trim() === "" &&
  filter.kinds.length === 0 &&
  filter.minPence <= bounds.minPence &&
  filter.maxPence >= bounds.maxPence;

/** Case- and accent-insensitive, so "giclee" finds "giclée". */
const normalise = (value: string): string =>
  value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const matchesQuery = (artwork: Artwork, query: string): boolean => {
  const needle = normalise(query);
  if (needle === "") return true;

  const haystack = normalise([artwork.title, artwork.medium, artwork.description].join(" "));
  return haystack.includes(needle);
};

/**
 * A piece with no listing has neither a price nor a product type.
 *
 * It is still worth showing — the artist publishes a piece and adds the Etsy
 * details afterwards — so it survives an unnarrowed filter and a search that
 * matches its words. It cannot survive a price range or a type filter, because
 * there is nothing on it for either to be true of.
 */
export const matchesFilter = (
  artwork: Artwork,
  filter: ShopFilter,
  bounds: PriceBounds,
): boolean => {
  if (!matchesQuery(artwork, filter.query)) return false;

  const listing = soleListing(artwork);
  if (!listing) return filter.kinds.length === 0 && isFullRange(filter, bounds);

  if (filter.kinds.length > 0 && !filter.kinds.includes(listing.kind)) return false;
  return listing.pricePence >= filter.minPence && listing.pricePence <= filter.maxPence;
};

const isFullRange = (filter: ShopFilter, bounds: PriceBounds): boolean =>
  filter.minPence <= bounds.minPence && filter.maxPence >= bounds.maxPence;

export const filterArtworks = (
  artworks: Artwork[],
  filter: ShopFilter,
  bounds: PriceBounds,
): Artwork[] => artworks.filter((artwork) => matchesFilter(artwork, filter, bounds));
