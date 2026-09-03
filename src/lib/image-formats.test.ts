import { describe, expect, it } from "vitest";
import {
  baseKeyOf,
  cacheKeyFor,
  MODERN_FORMATS,
  preferredFormat,
  splitExtension,
  widthOf,
  withExtension,
} from "./image-formats";

const AVIF = MODERN_FORMATS[0];
const WEBP = MODERN_FORMATS[1];

describe("splitExtension", () => {
  it("splits a stored key", () => {
    expect(splitExtension("artworks/ab12cd34-800.jpg")).toEqual({
      stem: "artworks/ab12cd34-800",
      extension: "jpg",
    });
  });

  it("lowercases the extension, because R2 keys are written lowercase", () => {
    expect(splitExtension("site/mark.PNG")?.extension).toBe("png");
  });

  it("refuses a key with nothing to split", () => {
    expect(splitExtension("artworks/nodot")).toBeNull();
    expect(splitExtension("artworks/trailing.")).toBeNull();
    expect(splitExtension(".hidden")).toBeNull();
  });
});

describe("baseKeyOf", () => {
  it("strips a width suffix", () => {
    expect(baseKeyOf("artworks/ab12cd34-800.jpg")).toBe("artworks/ab12cd34.jpg");
  });

  it("returns null for a base key, so a miss is not read twice", () => {
    expect(baseKeyOf("artworks/ab12cd34.jpg")).toBeNull();
  });

  it("does not mistake a hyphen in the name for a width", () => {
    expect(baseKeyOf("fonts/my-face.woff2")).toBeNull();
  });
});

describe("widthOf", () => {
  it("reads the rung a key asks for", () => {
    expect(widthOf("artworks/ab12cd34-1600.avif")).toBe(1600);
  });

  it("is null for a base key", () => {
    expect(widthOf("artworks/ab12cd34.jpg")).toBeNull();
  });
});

describe("preferredFormat", () => {
  it("takes AVIF over WebP when the browser offers both", () => {
    const chrome = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
    expect(preferredFormat(chrome)).toEqual(AVIF);
  });

  it("takes WebP when that is the best on offer", () => {
    expect(preferredFormat("image/webp,image/apng,image/*,*/*;q=0.8")).toEqual(WEBP);
  });

  it("is null for a browser that named neither", () => {
    expect(preferredFormat("image/png,image/*;q=0.8,*/*;q=0.5")).toBeNull();
    expect(preferredFormat("*/*")).toBeNull();
  });

  it("is null when there is no header at all", () => {
    expect(preferredFormat(null)).toBeNull();
  });
});

describe("cacheKeyFor", () => {
  it("gives each encoding its own entry", () => {
    const url = "https://charlottewilkinsonart.co.uk/media/artworks/ab12cd34-800.jpg";
    expect(cacheKeyFor(url, AVIF)).toBe(`${url}?fmt=avif`);
    expect(cacheKeyFor(url, WEBP)).toBe(`${url}?fmt=webp`);
    expect(cacheKeyFor(url, null)).toBe(url);
  });

  it("drops any query the request arrived with, so one object is one entry", () => {
    const url = "https://example.test/media/artworks/ab12cd34-800.jpg?v=2";
    expect(cacheKeyFor(url, null)).toBe("https://example.test/media/artworks/ab12cd34-800.jpg");
  });
});

describe("withExtension", () => {
  it("swaps the extension", () => {
    expect(withExtension("artworks/ab12cd34-800.jpg", "avif")).toBe("artworks/ab12cd34-800.avif");
  });

  it("leaves a key it cannot split alone", () => {
    expect(withExtension("artworks/nodot", "avif")).toBe("artworks/nodot");
  });
});
