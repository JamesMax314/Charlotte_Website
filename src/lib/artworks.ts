/**
 * The catalogue.
 *
 * Phase 1 serves seeded data from this module. Phase 2 replaces the bodies of the
 * accessors below with D1 queries — the signatures are already async so that swap
 * does not touch a single component. Shapes mirror docs/project-brief.md §6.
 */

export type ArtworkStatus = "draft" | "published" | "archived";
export type ListingKind = "print" | "digital";
export type Availability = "available" | "sold_out";

export interface ArtworkImage {
  /** Public path today; an R2 object key from Phase 2. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Listing {
  id: string;
  kind: ListingKind;
  label: string;
  etsyUrl: string;
  /**
   * Indicative only — Etsy is the source of truth for price and availability.
   * Integer pence, per the money invariant in the brief.
   */
  pricePence: number;
  availability: Availability;
  editionSize?: number;
  editionRemaining?: number;
}

export interface Artwork {
  slug: string;
  title: string;
  year: number;
  medium: string;
  dimensionsNote?: string;
  description: string;
  status: ArtworkStatus;
  sortOrder: number;
  isFeatured: boolean;
  images: ArtworkImage[];
  listings: Listing[];
}

const ETSY_SHOP = "https://www.etsy.com/uk/shop/CharlotteMakes";
const listingUrl = (id: string) => `${ETSY_SHOP}?listing=${id}`;

const ARTWORKS: Artwork[] = [
  {
    slug: "harbour-wall",
    title: "Harbour Wall",
    year: 2026,
    medium: "Ink and gouache on paper",
    dimensionsNote: "Original 42 × 52 cm",
    description:
      "Drawn from the end of the west pier on a cold morning, when the tide was low enough to walk out to the steps.",
    status: "published",
    sortOrder: 1,
    isFeatured: true,
    images: [
      {
        src: "/seed/harbour-wall.png",
        alt: "Ink drawing of a harbour wall with a blue form behind loose black contour lines",
        width: 1200,
        height: 1500,
      },
    ],
    listings: [
      {
        id: "harbour-a2",
        kind: "print",
        label: "A2 giclée print",
        etsyUrl: listingUrl("1401"),
        pricePence: 6500,
        availability: "available",
        editionSize: 25,
        editionRemaining: 18,
      },
      {
        id: "harbour-download",
        kind: "digital",
        label: "Digital download",
        etsyUrl: listingUrl("1402"),
        pricePence: 1200,
        availability: "available",
      },
    ],
  },
  {
    slug: "two-figures-walking",
    title: "Two Figures Walking",
    year: 2026,
    medium: "Brush pen on cartridge paper",
    dimensionsNote: "Original 40 × 40 cm",
    description: "One line, not lifted. The second figure arrived by accident and stayed.",
    status: "published",
    sortOrder: 2,
    isFeatured: true,
    images: [
      {
        src: "/seed/two-figures-walking.png",
        alt: "Square brush-pen drawing of two overlapping walking figures in black line",
        width: 1200,
        height: 1200,
      },
    ],
    listings: [
      {
        id: "two-figures-a3",
        kind: "print",
        label: "A3 giclée print",
        etsyUrl: listingUrl("1403"),
        pricePence: 4500,
        availability: "available",
        editionSize: 40,
        editionRemaining: 31,
      },
    ],
  },
  {
    slug: "the-long-field",
    title: "The Long Field",
    year: 2025,
    medium: "Screenprint, two colours",
    dimensionsNote: "Original 60 × 40 cm",
    description:
      "Printed over two afternoons. The blue went down first and had to dry overnight before the black.",
    status: "published",
    sortOrder: 3,
    isFeatured: true,
    images: [
      {
        src: "/seed/the-long-field.png",
        alt: "Landscape two-colour screenprint of a field, blue block beneath black line work",
        width: 1600,
        height: 1067,
      },
    ],
    listings: [
      {
        id: "long-field-print",
        kind: "print",
        label: "A2 giclée print",
        etsyUrl: listingUrl("1404"),
        pricePence: 7000,
        availability: "available",
        editionSize: 20,
        editionRemaining: 4,
      },
      {
        id: "long-field-download",
        kind: "digital",
        label: "Digital download",
        etsyUrl: listingUrl("1405"),
        pricePence: 1200,
        availability: "available",
      },
    ],
  },
  {
    slug: "kitchen-window",
    title: "Kitchen Window",
    year: 2025,
    medium: "Ink on paper",
    dimensionsNote: "Original 30 × 40 cm",
    description:
      "The same window, drawn most mornings for a fortnight. This is the one that worked.",
    status: "published",
    sortOrder: 4,
    isFeatured: false,
    images: [
      {
        src: "/seed/kitchen-window.png",
        alt: "Tall ink drawing of a kitchen window with a warm grey block and black contour lines",
        width: 1200,
        height: 1600,
      },
    ],
    listings: [
      {
        id: "kitchen-a3",
        kind: "print",
        label: "A3 giclée print",
        etsyUrl: listingUrl("1406"),
        pricePence: 4500,
        availability: "sold_out",
        editionSize: 30,
        editionRemaining: 0,
      },
    ],
  },
  {
    slug: "orchard-in-may",
    title: "Orchard in May",
    year: 2025,
    medium: "Ink and gouache on paper",
    dimensionsNote: "Original 42 × 52 cm",
    description: "Everything was blossom that week and none of it held still.",
    status: "published",
    sortOrder: 5,
    isFeatured: false,
    images: [
      {
        src: "/seed/orchard-in-may.png",
        alt: "Ink and gouache drawing of an orchard, warm grey shape behind dense black lines",
        width: 1200,
        height: 1500,
      },
    ],
    listings: [
      {
        id: "orchard-a3",
        kind: "print",
        label: "A3 giclée print",
        etsyUrl: listingUrl("1407"),
        pricePence: 4500,
        availability: "available",
        editionSize: 40,
        editionRemaining: 22,
      },
    ],
  },
  {
    // Display-only: no listings, so no buy panel renders at all (brief P-07).
    slug: "swimmers",
    title: "Swimmers",
    year: 2024,
    medium: "Brush pen on cartridge paper",
    dimensionsNote: "Original 42 × 52 cm",
    description: "Sold as an original. Not currently available as a print.",
    status: "published",
    sortOrder: 6,
    isFeatured: false,
    images: [
      {
        src: "/seed/swimmers.png",
        alt: "Brush-pen drawing of swimmers rendered in overlapping black contour lines",
        width: 1200,
        height: 1500,
      },
    ],
    listings: [],
  },
  {
    // Archived: off the index, but the URL still resolves (brief P-08).
    slug: "night-bus",
    title: "Night Bus",
    year: 2024,
    medium: "Screenprint, two colours",
    dimensionsNote: "Original 60 × 40 cm",
    description: "A sold-out edition from 2024, kept here because people still ask about it.",
    status: "archived",
    sortOrder: 7,
    isFeatured: false,
    images: [
      {
        src: "/seed/night-bus.png",
        alt: "Landscape screenprint of a night bus interior, blue block with black line work",
        width: 1600,
        height: 1067,
      },
    ],
    listings: [
      {
        id: "night-bus-print",
        kind: "print",
        label: "A2 giclée print",
        etsyUrl: listingUrl("1408"),
        pricePence: 7000,
        availability: "sold_out",
        editionSize: 15,
        editionRemaining: 0,
      },
    ],
  },
  {
    // Draft: must not be reachable publicly, including by direct URL (brief A-09).
    slug: "her-mothers-coat",
    title: "Her Mother's Coat",
    year: 2026,
    medium: "Ink on paper",
    description: "Unfinished.",
    status: "draft",
    sortOrder: 8,
    isFeatured: false,
    images: [
      {
        src: "/seed/her-mothers-coat.png",
        alt: "Ink drawing of a coat hanging, loose black contour lines",
        width: 1200,
        height: 1600,
      },
    ],
    listings: [],
  },
];

const bySortOrder = (a: Artwork, b: Artwork) => a.sortOrder - b.sortOrder;

/** Everything that belongs in the public gallery, in the artist's chosen order. */
export const getPublishedArtworks = async (): Promise<Artwork[]> =>
  ARTWORKS.filter((a) => a.status === "published").sort(bySortOrder);

export const getFeaturedArtworks = async (): Promise<Artwork[]> =>
  (await getPublishedArtworks()).filter((a) => a.isFeatured);

/**
 * Published and archived work both resolve; drafts do not. Archived pieces keep
 * working URLs so a link shared two years ago never 404s.
 */
export const getArtworkBySlug = async (slug: string): Promise<Artwork | undefined> =>
  ARTWORKS.find((a) => a.slug === slug && a.status !== "draft");

/** Every slug that should be prerendered and appear in the sitemap. */
export const getRoutableSlugs = async (): Promise<string[]> =>
  ARTWORKS.filter((a) => a.status !== "draft")
    .sort(bySortOrder)
    .map((a) => a.slug);

export const getSiteSettings = async () => ({
  etsyShopUrl: ETSY_SHOP,
  contactEmail: "hello@example.com",
  instagramUrl: "https://www.instagram.com/",
});

/** A listing is buyable only when Etsy still has stock. */
export const isBuyable = (listing: Listing) => listing.availability === "available";

/**
 * The price a card should advertise.
 *
 * Prints are the headline product, so a cheap digital download must not set the
 * "from" price: advertising "From £12" beside a £65 print is true but misleading.
 * Falls back to whatever is buyable when there is no print.
 */
export const headlinePricePence = (artwork: Artwork): number | null => {
  const buyable = artwork.listings.filter(isBuyable);
  if (buyable.length === 0) return null;

  const prints = buyable.filter((l) => l.kind === "print");
  const pool = prints.length > 0 ? prints : buyable;
  return Math.min(...pool.map((l) => l.pricePence));
};

/** True when every listing has sold out — a different state from having none. */
export const isSoldOut = (artwork: Artwork) =>
  artwork.listings.length > 0 && artwork.listings.every((l) => !isBuyable(l));
