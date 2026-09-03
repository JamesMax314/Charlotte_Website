import { describe, expect, it } from "vitest";
import { assetKey, contentHash, derivativeKeys, isSafeKey, usableKeys } from "./storage";
import { MODERN_FORMATS } from "./image-formats";

const bytesOf = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("contentHash", () => {
  it("is 16 hex characters", async () => {
    expect(await contentHash(bytesOf("anything"))).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives identical bytes the same key", async () => {
    // This is what makes a re-upload a no-op, and why the replace path must
    // not delete the old object when the key has not changed.
    expect(await contentHash(bytesOf("same"))).toBe(await contentHash(bytesOf("same")));
  });

  it("gives different bytes a different key", async () => {
    expect(await contentHash(bytesOf("one"))).not.toBe(await contentHash(bytesOf("two")));
  });
});

describe("assetKey", () => {
  it("joins the prefix, hash and extension", () => {
    expect(assetKey("site", "0123456789abcdef", "png")).toBe("site/0123456789abcdef.png");
    expect(assetKey("fonts", "0123456789abcdef", "woff2")).toBe("fonts/0123456789abcdef.woff2");
  });
});

describe("derivativeKeys", () => {
  it("names every rung beside the base key, in every encoding", () => {
    expect(derivativeKeys("site/abc.jpg", [400, 800])).toEqual([
      "site/abc-400.jpg",
      "site/abc-400.avif",
      "site/abc-400.webp",
      "site/abc-800.jpg",
      "site/abc-800.avif",
      "site/abc-800.webp",
    ]);
  });

  /*
    The regression this function was rewritten for. `/media` writes an AVIF or
    WebP object the first time a browser asks for a rung, so those encodings
    make up most of what is in the bucket — and while this named only the
    original extension, every one of them survived the delete that removed the
    piece. Nothing reads an orphan and nothing reports it; the only symptom is
    the storage bill. Asserted by name rather than by count so that adding a
    format to MODERN_FORMATS without revisiting the deletes fails here.
  */
  it("names the modern encodings, which a delete would otherwise orphan", () => {
    const keys = derivativeKeys("artworks/ab12cd34.jpg", [1600]);
    expect(keys).toContain("artworks/ab12cd34-1600.avif");
    expect(keys).toContain("artworks/ab12cd34-1600.webp");
  });

  it("covers every format the pipeline can write", () => {
    const keys = derivativeKeys("artworks/ab12cd34.jpg", [800]);
    for (const format of MODERN_FORMATS) {
      expect(keys).toContain(`artworks/ab12cd34-800.${format.extension}`);
    }
  });

  it("is empty for a key with no extension", () => {
    expect(derivativeKeys("site/abc", [400])).toEqual([]);
  });

  it("only splits on the final dot", () => {
    expect(derivativeKeys("site/a.b.jpg", [400])).toEqual([
      "site/a.b-400.jpg",
      "site/a.b-400.avif",
      "site/a.b-400.webp",
    ]);
  });

  /*
    A PNG mark or a WebP upload keeps its own extension in the first slot, so
    the original is never assumed to be a JPEG — and a source that is already
    one of the modern formats must not be named twice, or the delete would
    issue a duplicate key.
  */
  it("keeps the source's own extension without repeating it", () => {
    expect(derivativeKeys("site/mark.webp", [400])).toEqual([
      "site/mark-400.webp",
      "site/mark-400.avif",
    ]);
  });
});

describe("isSafeKey", () => {
  it("accepts the keys the pipeline writes", () => {
    expect(isSafeKey("artworks/0123456789abcdef.jpg")).toBe(true);
    expect(isSafeKey("site/0123456789abcdef-800.jpg")).toBe(true);
    expect(isSafeKey("fonts/0123456789abcdef.woff2")).toBe(true);
  });

  it("rejects traversal and absolute paths", () => {
    expect(isSafeKey("../../secrets.txt")).toBe(false);
    expect(isSafeKey("site/../../secrets.jpg")).toBe(false);
    expect(isSafeKey("/site/abc.jpg")).toBe(false);
  });

  it("rejects an empty or extensionless key", () => {
    expect(isSafeKey("")).toBe(false);
    expect(isSafeKey("site/abc")).toBe(false);
  });
});

describe("usableKeys", () => {
  /*
    The guard both sides of the media deletion queue share. If they disagreed
    about which keys they act on, one would strand a row in the queue and the
    other would delete an object still in use.
  */
  it("drops nulls, blanks and anything unsafe", () => {
    expect(
      usableKeys(["artworks/a1.jpg", null, undefined, "", "../escape.jpg", "/leading.jpg"]),
    ).toEqual(["artworks/a1.jpg"]);
  });

  it("de-duplicates, because the same file yields the same key", () => {
    expect(usableKeys(["artworks/a1.jpg", "artworks/a1.jpg"])).toEqual(["artworks/a1.jpg"]);
  });

  it("keeps every distinct key, in the order given", () => {
    expect(usableKeys(["fonts/b.woff2", "artworks/a.jpg"])).toEqual([
      "fonts/b.woff2",
      "artworks/a.jpg",
    ]);
  });

  it("returns nothing for a list with nothing usable in it", () => {
    expect(usableKeys([null, undefined, ""])).toEqual([]);
  });
});
