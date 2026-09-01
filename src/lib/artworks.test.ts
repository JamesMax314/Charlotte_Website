import { describe, expect, it } from "vitest";
import {
  isPlaceholderSlug,
  primaryImage,
  soleListing,
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
  label: "A2",
  etsyUrl: "https://www.etsy.com/listing/1",
  pricePence: 6500,
  availability: "available",
  ...over,
});

describe("isSoldOut", () => {
  it("distinguishes sold out from never having been for sale", () => {
    expect(isSoldOut(artwork([listing({ availability: "sold_out" })]))).toBe(true);
    expect(isSoldOut(artwork([]))).toBe(false);
  });
});

describe("primaryImage", () => {
  // The artist creates a piece, publishes it, and uploads photographs later.
  // Every rendering surface has to survive that gap.
  it("returns undefined when the piece has no photograph yet", () => {
    expect(primaryImage(artwork([]))).toBeUndefined();
  });

  it("returns the first image when there are several", () => {
    const a = artwork([]);
    a.images = [
      { id: "1", src: "/media/a.jpg", alt: "a", width: 10, height: 10 },
      { id: "2", src: "/media/b.jpg", alt: "b", width: 10, height: 10 },
    ];
    expect(primaryImage(a)?.id).toBe("1");
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

describe("isPlaceholderSlug", () => {
  it("recognises the auto-generated slugs so they follow the title", () => {
    expect(isPlaceholderSlug("untitled")).toBe(true);
    expect(isPlaceholderSlug("untitled-3")).toBe(true);
  });

  it("leaves a slug the artist chose alone", () => {
    expect(isPlaceholderSlug("ltw-mag")).toBe(false);
    expect(isPlaceholderSlug("untitled-sketches")).toBe(false);
    expect(isPlaceholderSlug("the-untitled-one")).toBe(false);
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

describe("soleListing", () => {
  it("is undefined before the artist has added the Etsy details", () => {
    expect(soleListing(artwork([]))).toBeUndefined();
  });

  it("takes the first listing, ignoring any left over from the multi-size editor", () => {
    const first = listing({ id: "l1", pricePence: 4500 });
    const stale = listing({ id: "l2", pricePence: 9900 });
    expect(soleListing(artwork([first, stale]))).toBe(first);
  });
});
