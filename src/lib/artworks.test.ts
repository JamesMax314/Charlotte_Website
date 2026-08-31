import { describe, expect, it } from "vitest";
import {
  headlinePricePence,
  isInGallery,
  isPubliclyRoutable,
  isSoldOut,
  isValidEtsyUrl,
  toSlug,
  type Artwork,
} from "./artworks";

const artwork = (listings: Artwork["listings"]): Artwork => ({
  id: "a",
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

const listing = (over: Partial<Artwork["listings"][number]>): Artwork["listings"][number] => ({
  id: "l",
  kind: "print",
  label: "A2",
  etsyUrl: "https://www.etsy.com/listing/1",
  pricePence: 6500,
  availability: "available",
  ...over,
});

describe("headlinePricePence", () => {
  it("ignores a cheaper digital download when a print is available", () => {
    const a = artwork([
      listing({ id: "p", kind: "print", pricePence: 6500 }),
      listing({ id: "d", kind: "digital", pricePence: 1200 }),
    ]);
    expect(headlinePricePence(a)).toBe(6500);
  });

  it("falls back to a download when there is no print", () => {
    expect(headlinePricePence(artwork([listing({ kind: "digital", pricePence: 1200 })]))).toBe(
      1200,
    );
  });

  it("takes the cheapest of several available prints", () => {
    const a = artwork([
      listing({ id: "a", pricePence: 6500 }),
      listing({ id: "b", pricePence: 4500 }),
    ]);
    expect(headlinePricePence(a)).toBe(4500);
  });

  it("skips sold-out prints when pricing", () => {
    const a = artwork([
      listing({ id: "a", pricePence: 4500, availability: "sold_out" }),
      listing({ id: "b", pricePence: 6500 }),
    ]);
    expect(headlinePricePence(a)).toBe(6500);
  });

  it("returns null when nothing is for sale", () => {
    expect(headlinePricePence(artwork([]))).toBeNull();
  });
});

describe("isSoldOut", () => {
  it("distinguishes sold out from never having been for sale", () => {
    expect(isSoldOut(artwork([listing({ availability: "sold_out" })]))).toBe(true);
    expect(isSoldOut(artwork([]))).toBe(false);
  });
});

describe("visibility", () => {
  it("keeps archived work out of the gallery but alive at its URL", () => {
    expect(isInGallery("archived")).toBe(false);
    expect(isPubliclyRoutable("archived")).toBe(true);
  });

  it("hides drafts entirely", () => {
    expect(isInGallery("draft")).toBe(false);
    expect(isPubliclyRoutable("draft")).toBe(false);
  });

  it("shows published work everywhere", () => {
    expect(isInGallery("published")).toBe(true);
    expect(isPubliclyRoutable("published")).toBe(true);
  });
});

describe("isValidEtsyUrl", () => {
  it("accepts etsy listing urls, including regional subdomains", () => {
    expect(isValidEtsyUrl("https://www.etsy.com/uk/listing/123/a-print")).toBe(true);
    expect(isValidEtsyUrl("https://etsy.com/listing/123")).toBe(true);
  });

  it("rejects look-alike hosts", () => {
    expect(isValidEtsyUrl("https://etsy.com.evil.example/listing/1")).toBe(false);
    expect(isValidEtsyUrl("https://notetsy.com/listing/1")).toBe(false);
  });

  it("rejects insecure and malformed urls", () => {
    expect(isValidEtsyUrl("http://www.etsy.com/listing/1")).toBe(false);
    expect(isValidEtsyUrl("not a url")).toBe(false);
    expect(isValidEtsyUrl("")).toBe(false);
  });
});

describe("toSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(toSlug("The Long Field")).toBe("the-long-field");
  });

  it("drops apostrophes rather than turning them into hyphens", () => {
    expect(toSlug("Her Mother's Coat")).toBe("her-mothers-coat");
  });

  it("trims punctuation from the ends", () => {
    expect(toSlug("  Swimmers!  ")).toBe("swimmers");
  });
});
