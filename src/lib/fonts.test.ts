import { describe, expect, it } from "vitest";
import {
  BUILT_IN_FONTS,
  DEFAULT_FONT_ID,
  isKnownFontId,
  resolveFontFamily,
  type FontOption,
} from "./fonts";

describe("BUILT_IN_FONTS", () => {
  it("has unique ids, since the id is what gets stored", () => {
    const ids = BUILT_IN_FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the default", () => {
    expect(isKnownFontId(DEFAULT_FONT_ID)).toBe(true);
  });

  it("gives every font a fallback family, so a failed webfont still renders", () => {
    for (const font of BUILT_IN_FONTS) {
      expect(font.family).toContain(",");
    }
  });
});

describe("resolveFontFamily", () => {
  it("resolves a known id to its stack", () => {
    expect(resolveFontFamily("serif")).toContain("--font-fraunces");
  });

  /**
   * The case that matters once fonts can be uploaded: deleting a font leaves
   * text boxes pointing at a key that no longer resolves.
   */
  it("falls back to the default rather than returning nothing", () => {
    const resolved = resolveFontFamily("a-font-that-was-deleted");
    expect(resolved).toBe(resolveFontFamily(DEFAULT_FONT_ID));
    expect(resolved).toBeTruthy();
  });

  it("accepts a custom list, which is how uploaded fonts will arrive", () => {
    const custom: FontOption[] = [
      ...BUILT_IN_FONTS,
      { id: "hers", label: "Hers", family: '"Hers", sans-serif' },
    ];
    expect(resolveFontFamily("hers", custom)).toBe('"Hers", sans-serif');
    expect(resolveFontFamily("hers")).toBe(resolveFontFamily(DEFAULT_FONT_ID));
  });

  it("still returns something usable if the default is missing from the list", () => {
    const odd: FontOption[] = [{ id: "only", label: "Only", family: "serif" }];
    expect(resolveFontFamily("nope", odd)).toBe("serif");
  });
});

describe("isKnownFontId", () => {
  it("rejects unknown ids so they are never written to the database", () => {
    expect(isKnownFontId("serif")).toBe(true);
    expect(isKnownFontId("../../etc/passwd")).toBe(false);
    expect(isKnownFontId("")).toBe(false);
  });
});
