import { describe, expect, it } from "vitest";
import type { Artwork } from "./artworks";
import { matchesQuery, searchArtworks } from "./shop-filter";

const piece = (over: Partial<Artwork> = {}): Artwork => ({
  id: "a",
  slug: "x",
  title: "Harbour Light",
  year: 2026,
  medium: "Linocut",
  description: "A quiet morning.",
  status: "published",
  sortOrder: 1,
  isFeatured: false,
  images: [],
  listings: [
    {
      id: "l",
      label: "A3 giclée print",
      etsyUrl: "https://www.etsy.com/listing/1",
      pricePence: 4500,
      availability: "available",
    },
  ],
  ...over,
});

describe("matchesQuery", () => {
  it("searches the title, the medium and the description together", () => {
    const a = piece();
    expect(matchesQuery(a, "harbour")).toBe(true);
    expect(matchesQuery(a, "linocut")).toBe(true);
    expect(matchesQuery(a, "quiet")).toBe(true);
    expect(matchesQuery(a, "harbor")).toBe(false);
  });

  // The type is her own words, not a fixed set, so it has to be searchable —
  // it is the only place "giclée" appears on some pieces.
  it("searches the product type she typed", () => {
    expect(matchesQuery(piece(), "giclée")).toBe(true);
  });

  it("ignores case and accents, so 'giclee' finds 'giclée'", () => {
    expect(matchesQuery(piece(), "GICLEE")).toBe(true);
  });

  it("keeps everything when nothing has been typed", () => {
    expect(matchesQuery(piece(), "")).toBe(true);
    expect(matchesQuery(piece(), "   ")).toBe(true);
  });

  it("copes with a piece the artist has not listed on Etsy yet", () => {
    const unlisted = piece({ listings: [] });
    expect(matchesQuery(unlisted, "harbour")).toBe(true);
    expect(matchesQuery(unlisted, "giclée")).toBe(false);
  });
});

describe("searchArtworks", () => {
  it("keeps the artist's order", () => {
    const all = [
      piece({ slug: "a", title: "Harbour Light" }),
      piece({ slug: "b", title: "Harbour Dark" }),
      piece({ slug: "c", title: "Tennis Serve", medium: "Digital", listings: [] }),
    ];
    expect(searchArtworks(all, "harbour").map((a) => a.slug)).toEqual(["a", "b"]);
  });
});
