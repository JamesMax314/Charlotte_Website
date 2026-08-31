import { describe, expect, it } from "vitest";
import {
  getArtworkBySlug,
  getPublishedArtworks,
  getRoutableSlugs,
  headlinePricePence,
  isSoldOut,
  type Artwork,
} from "./artworks";

const artwork = (listings: Artwork["listings"]): Artwork => ({
  slug: "x",
  title: "X",
  year: 2026,
  medium: "Ink",
  description: "",
  status: "published",
  sortOrder: 1,
  isFeatured: false,
  images: [],
  listings,
});

describe("headlinePricePence", () => {
  it("ignores a cheaper digital download when a print is available", () => {
    const a = artwork([
      {
        id: "p",
        kind: "print",
        label: "A2",
        etsyUrl: "",
        pricePence: 6500,
        availability: "available",
      },
      {
        id: "d",
        kind: "digital",
        label: "File",
        etsyUrl: "",
        pricePence: 1200,
        availability: "available",
      },
    ]);
    expect(headlinePricePence(a)).toBe(6500);
  });

  it("falls back to a download when there is no print", () => {
    const a = artwork([
      {
        id: "d",
        kind: "digital",
        label: "File",
        etsyUrl: "",
        pricePence: 1200,
        availability: "available",
      },
    ]);
    expect(headlinePricePence(a)).toBe(1200);
  });

  it("takes the cheapest of several available prints", () => {
    const a = artwork([
      {
        id: "a",
        kind: "print",
        label: "A2",
        etsyUrl: "",
        pricePence: 6500,
        availability: "available",
      },
      {
        id: "b",
        kind: "print",
        label: "A3",
        etsyUrl: "",
        pricePence: 4500,
        availability: "available",
      },
    ]);
    expect(headlinePricePence(a)).toBe(4500);
  });

  it("skips sold-out prints when pricing", () => {
    const a = artwork([
      {
        id: "a",
        kind: "print",
        label: "A3",
        etsyUrl: "",
        pricePence: 4500,
        availability: "sold_out",
      },
      {
        id: "b",
        kind: "print",
        label: "A2",
        etsyUrl: "",
        pricePence: 6500,
        availability: "available",
      },
    ]);
    expect(headlinePricePence(a)).toBe(6500);
  });

  it("returns null when nothing is for sale", () => {
    expect(headlinePricePence(artwork([]))).toBeNull();
  });
});

describe("isSoldOut", () => {
  it("distinguishes sold out from never having been for sale", () => {
    const soldOut = artwork([
      {
        id: "a",
        kind: "print",
        label: "A3",
        etsyUrl: "",
        pricePence: 4500,
        availability: "sold_out",
      },
    ]);
    expect(isSoldOut(soldOut)).toBe(true);
    expect(isSoldOut(artwork([]))).toBe(false);
  });
});

describe("catalogue visibility", () => {
  it("keeps drafts out of the gallery and off their own URL", async () => {
    const published = await getPublishedArtworks();
    expect(published.some((a) => a.slug === "her-mothers-coat")).toBe(false);
    expect(await getArtworkBySlug("her-mothers-coat")).toBeUndefined();
    expect(await getRoutableSlugs()).not.toContain("her-mothers-coat");
  });

  it("hides archived work from the gallery but keeps its URL alive", async () => {
    const published = await getPublishedArtworks();
    expect(published.some((a) => a.slug === "night-bus")).toBe(false);
    expect(await getArtworkBySlug("night-bus")).toBeDefined();
    expect(await getRoutableSlugs()).toContain("night-bus");
  });

  it("returns the gallery in the artist's chosen order", async () => {
    const published = await getPublishedArtworks();
    const orders = published.map((a) => a.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
