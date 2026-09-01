import { describe, expect, it } from "vitest";
import type { Artwork } from "./artworks";
import {
  defaultFilter,
  filterArtworks,
  isDefaultFilter,
  matchesFilter,
  priceBounds,
  type ShopFilter,
} from "./shop-filter";

const piece = (over: Partial<Artwork> = {}): Artwork => ({
  id: "a",
  slug: "x",
  title: "Harbour Light",
  year: 2026,
  medium: "Giclée print",
  description: "A quiet morning.",
  status: "published",
  sortOrder: 1,
  isFeatured: false,
  images: [],
  listings: [
    {
      id: "l",
      kind: "print",
      label: "A3",
      etsyUrl: "https://www.etsy.com/listing/1",
      pricePence: 4500,
      availability: "available",
    },
  ],
  ...over,
});

const priced = (pricePence: number, over: Partial<Artwork> = {}): Artwork => {
  const base = piece(over);
  return { ...base, listings: [{ ...base.listings[0], pricePence }] };
};

const bounds = { minPence: 1200, maxPence: 9900 };
const wideOpen: ShopFilter = { query: "", kinds: [], minPence: 1200, maxPence: 9900 };

describe("priceBounds", () => {
  it("spans the cheapest and dearest piece", () => {
    expect(priceBounds([priced(4500), priced(1200), priced(9900)])).toEqual({
      minPence: 1200,
      maxPence: 9900,
    });
  });

  it("collapses to zero for an empty shop rather than to Infinity", () => {
    expect(priceBounds([])).toEqual({ minPence: 0, maxPence: 0 });
  });

  it("ignores a piece the artist has not listed on Etsy yet", () => {
    expect(priceBounds([priced(4500), piece({ listings: [] })])).toEqual({
      minPence: 4500,
      maxPence: 4500,
    });
  });
});

describe("matchesFilter", () => {
  it("searches the title, the medium and the description together", () => {
    const a = piece({ title: "Harbour Light", medium: "Linocut", description: "Winter light." });
    expect(matchesFilter(a, { ...wideOpen, query: "harbour" }, bounds)).toBe(true);
    expect(matchesFilter(a, { ...wideOpen, query: "linocut" }, bounds)).toBe(true);
    expect(matchesFilter(a, { ...wideOpen, query: "winter" }, bounds)).toBe(true);
    expect(matchesFilter(a, { ...wideOpen, query: "harbor" }, bounds)).toBe(false);
  });

  it("ignores case and accents, so 'giclee' finds 'giclée'", () => {
    expect(matchesFilter(piece(), { ...wideOpen, query: "GICLEE" }, bounds)).toBe(true);
  });

  it("keeps a piece inside the price range and drops one outside it", () => {
    expect(matchesFilter(priced(4500), { ...wideOpen, minPence: 4000 }, bounds)).toBe(true);
    expect(matchesFilter(priced(4500), { ...wideOpen, minPence: 5000 }, bounds)).toBe(false);
    expect(matchesFilter(priced(4500), { ...wideOpen, maxPence: 4000 }, bounds)).toBe(false);
  });

  it("includes the bounds themselves, so the widest range keeps everything", () => {
    expect(matchesFilter(priced(1200), wideOpen, bounds)).toBe(true);
    expect(matchesFilter(priced(9900), wideOpen, bounds)).toBe(true);
  });

  it("narrows by product type only when a type is chosen", () => {
    const download = piece({ listings: [{ ...piece().listings[0], kind: "digital" }] });
    expect(matchesFilter(download, wideOpen, bounds)).toBe(true);
    expect(matchesFilter(download, { ...wideOpen, kinds: ["digital"] }, bounds)).toBe(true);
    expect(matchesFilter(download, { ...wideOpen, kinds: ["print"] }, bounds)).toBe(false);
  });

  // She publishes a piece, then adds the Etsy details afterwards. It has no
  // price and no type, so no narrowed filter can be true of it.
  it("shows an unlisted piece by default and hides it once anything is narrowed", () => {
    const unlisted = piece({ listings: [] });
    expect(matchesFilter(unlisted, wideOpen, bounds)).toBe(true);
    expect(matchesFilter(unlisted, { ...wideOpen, query: "harbour" }, bounds)).toBe(true);
    expect(matchesFilter(unlisted, { ...wideOpen, kinds: ["print"] }, bounds)).toBe(false);
    expect(matchesFilter(unlisted, { ...wideOpen, minPence: 2000 }, bounds)).toBe(false);
  });
});

describe("filterArtworks", () => {
  it("keeps the artist's order", () => {
    const all = [
      priced(4500, { slug: "a" }),
      priced(1200, { slug: "b" }),
      priced(9900, { slug: "c" }),
    ];
    const kept = filterArtworks(all, { ...wideOpen, minPence: 1200, maxPence: 4500 }, bounds);
    expect(kept.map((a) => a.slug)).toEqual(["a", "b"]);
  });
});

describe("isDefaultFilter", () => {
  it("is true for the filter the page opens with", () => {
    expect(isDefaultFilter(defaultFilter(bounds), bounds)).toBe(true);
  });

  it("is false as soon as anything is narrowed", () => {
    const base = defaultFilter(bounds);
    expect(isDefaultFilter({ ...base, query: "harbour" }, bounds)).toBe(false);
    expect(isDefaultFilter({ ...base, kinds: ["print"] }, bounds)).toBe(false);
    expect(isDefaultFilter({ ...base, minPence: 2000 }, bounds)).toBe(false);
    expect(isDefaultFilter({ ...base, maxPence: 8000 }, bounds)).toBe(false);
  });

  it("treats whitespace in the search box as nothing typed", () => {
    expect(isDefaultFilter({ ...defaultFilter(bounds), query: "   " }, bounds)).toBe(true);
  });
});
