import { describe, expect, it } from "vitest";
import {
  BUILT_IN_FONTS,
  cssFamilyName,
  DEFAULT_FONT_ID,
  fontFaceCss,
  fontFormatFor,
  isKnownFontId,
  mergeFonts,
  newFontId,
  resolveFontFamily,
  uploadedFontOption,
  type FontOption,
  type UploadedFont,
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

const hers: UploadedFont = {
  id: "font-1a2b3c4d",
  label: "Hers",
  family: "Hers",
  storageKey: "fonts/0123456789abcdef.woff2",
  format: "woff2",
};

describe("fontFormatFor", () => {
  it("maps every extension the uploader accepts", () => {
    expect(fontFormatFor("Hers.woff2")).toBe("woff2");
    expect(fontFormatFor("Hers.woff")).toBe("woff");
    expect(fontFormatFor("Hers.ttf")).toBe("truetype");
    expect(fontFormatFor("Hers.otf")).toBe("opentype");
  });

  it("ignores case, because macOS and Windows disagree about it", () => {
    expect(fontFormatFor("HERS.WOFF2")).toBe("woff2");
  });

  it("rejects anything that is not a font", () => {
    // The gate is the extension, not file.type: browsers report a font upload
    // as font/woff2, application/octet-stream or "" depending on the platform.
    expect(fontFormatFor("Hers.png")).toBeNull();
    expect(fontFormatFor("Hers")).toBeNull();
    expect(fontFormatFor("")).toBeNull();
    expect(fontFormatFor("Hers.woff2.exe")).toBeNull();
  });
});

describe("cssFamilyName", () => {
  it("keeps an ordinary name", () => {
    expect(cssFamilyName("Her Face")).toBe("Her Face");
    expect(cssFamilyName("Sub-Grotesk 2")).toBe("Sub-Grotesk 2");
  });

  it("strips anything that could break out of the @font-face rule", () => {
    // The name is interpolated into a <style> that ships on every page.
    expect(cssFamilyName('Bad"; } body { display: none }')).toBe("Bad body display none");
    expect(cssFamilyName("A\nB")).toBe("A B");
    expect(cssFamilyName("</style><script>")).toBe("style script");
  });

  it("falls back rather than yielding an empty family", () => {
    expect(cssFamilyName("")).toBe("Uploaded font");
    expect(cssFamilyName("!!!")).toBe("Uploaded font");
  });
});

describe("newFontId", () => {
  it("is always prefixed, so a font cannot shadow a built-in", () => {
    // A file uploaded as sans.woff2 must not be able to claim the id "sans".
    const id = newFontId();
    expect(id).toMatch(/^font-[0-9a-f]{8}$/);
    expect(BUILT_IN_FONTS.some((font) => font.id === id)).toBe(false);
  });
});

describe("mergeFonts", () => {
  it("puts the built-ins first and appends the uploads", () => {
    const merged = mergeFonts([hers]);
    expect(merged.slice(0, BUILT_IN_FONTS.length)).toEqual(BUILT_IN_FONTS);
    expect(merged.at(-1)).toEqual(uploadedFontOption(hers));
  });

  it("gives an uploaded font a complete stack, so resolveFontFamily is unchanged", () => {
    const merged = mergeFonts([hers]);
    expect(resolveFontFamily(hers.id, merged)).toBe('"Hers", ui-sans-serif, sans-serif');
  });

  it("falls back to Inter once a font is deleted", () => {
    // deleteSiteFont deliberately leaves wall_texts alone; this is what keeps
    // those text boxes readable rather than sweeping the table.
    expect(resolveFontFamily(hers.id, mergeFonts([]))).toBe(resolveFontFamily(DEFAULT_FONT_ID));
  });

  it("is the list the write guard checks against", () => {
    expect(isKnownFontId(hers.id, mergeFonts([hers]))).toBe(true);
    expect(isKnownFontId(hers.id, mergeFonts([]))).toBe(false);
  });
});

describe("fontFaceCss", () => {
  it("emits nothing when there are no uploads", () => {
    expect(fontFaceCss([])).toBe("");
  });

  it("points at the /media route and swaps rather than blocking", () => {
    const css = fontFaceCss([hers]);
    expect(css).toContain('font-family:"Hers"');
    expect(css).toContain('url("/media/fonts/0123456789abcdef.woff2") format("woff2")');
    expect(css).toContain("font-display:swap");
  });

  it("emits one rule per font", () => {
    const css = fontFaceCss([hers, { ...hers, id: "font-2", family: "Other" }]);
    expect(css.match(/@font-face/g)).toHaveLength(2);
  });
});
