/**
 * Catalogue domain types and the rules that operate on them.
 *
 * Deliberately free of any database access so every rule here is unit-testable
 * without a binding. D1 queries live in src/lib/catalogue.ts.
 */

export type ArtworkStatus = "draft" | "published" | "archived";
export type ListingKind = "print" | "digital";
export type Availability = "available" | "sold_out";

export interface ArtworkImage {
  id: string;
  /** Public path, always served through the /media route. */
  src: string;
  alt: string;
  width: number;
  height: number;
  lqip?: string | null;
}

export interface Listing {
  id: string;
  kind: ListingKind;
  label: string;
  etsyUrl: string;
  /** Indicative only — Etsy is the source of truth. Integer pence. */
  pricePence: number;
  availability: Availability;
  editionSize?: number | null;
  editionRemaining?: number | null;
}

export interface Artwork {
  id: string;
  slug: string;
  title: string;
  year: number;
  medium: string;
  dimensionsNote?: string | null;
  description: string;
  status: ArtworkStatus;
  sortOrder: number;
  isFeatured: boolean;
  images: ArtworkImage[];
  listings: Listing[];
}

/**
 * Archived and draft are different kinds of hidden.
 *
 * Archived work leaves the gallery but keeps a working URL, because a link
 * shared two years ago must not 404. Drafts resolve to nothing at all.
 */
export const isInGallery = (status: ArtworkStatus) => status === "published";
export const isPubliclyRoutable = (status: ArtworkStatus) => status !== "draft";

/**
 * The image to lead with, if there is one.
 *
 * An artwork can legitimately have no images: the artist creates the piece,
 * publishes it, and uploads photographs afterwards. Every surface that renders
 * artwork must cope with that rather than assuming images[0] exists.
 */
export const primaryImage = (artwork: Artwork): ArtworkImage | undefined => artwork.images[0];

/** A listing is buyable only while Etsy still has stock. */
export const isBuyable = (listing: Listing) => listing.availability === "available";

/** True when every listing has sold out — a different state from having none. */
export const isSoldOut = (artwork: Artwork) =>
  artwork.listings.length > 0 && artwork.listings.every((l) => !isBuyable(l));

/**
 * The price a card should advertise.
 *
 * Prints are the headline product, so a cheap digital download must not set the
 * "from" price: advertising "From £12" beside a £65 print is true and misleading
 * at once. Falls back to whatever is buyable when there is no print.
 */
export const headlinePricePence = (artwork: Artwork): number | null => {
  const buyable = artwork.listings.filter(isBuyable);
  if (buyable.length === 0) return null;

  const prints = buyable.filter((l) => l.kind === "print");
  const pool = prints.length > 0 ? prints : buyable;
  return Math.min(...pool.map((l) => l.pricePence));
};

/** Etsy links must actually point at Etsy (brief A-08). */
export const isValidEtsyUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)etsy\.com$/.test(url.hostname);
  } catch {
    return false;
  }
};

/**
 * True for a slug still carrying its auto-generated placeholder.
 *
 * New pieces are created as "Untitled" so the artist can start uploading
 * immediately, which seeds slugs like `untitled-3`. Those should follow the
 * title once she names the piece — otherwise every artwork ends up at a
 * meaningless URL. A slug she has deliberately edited is hers and is left alone.
 */
export const isPlaceholderSlug = (slug: string): boolean => /^untitled(-\d+)?$/.test(slug.trim());

/** Slugs are lowercase, hyphenated, and safe in a URL path. */
export const toSlug = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
