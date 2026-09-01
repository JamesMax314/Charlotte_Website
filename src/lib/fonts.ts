/**
 * The typefaces a text box can use.
 *
 * Pure and client-safe, like src/lib/snap.ts: the admin toolbar is a client
 * component, so nothing server-only may be imported here.
 *
 * Fonts are referenced by an open string key rather than a database enum,
 * because the artist will later be able to upload her own. An enum would need a
 * schema migration for every font she added.
 */

export interface FontOption {
  id: string;
  label: string;
  /**
   * A complete CSS font-family value, not just a variable name.
   *
   * This is what lets uploaded fonts join later: they will supply
   * `"Her Font", sans-serif` backed by an @font-face served from R2, and none
   * of the consumers need to change.
   */
  family: string;
}

export const DEFAULT_FONT_ID = "sans";

export const BUILT_IN_FONTS: FontOption[] = [
  { id: "sans", label: "Inter", family: "var(--font-inter), ui-sans-serif, sans-serif" },
  { id: "serif", label: "Fraunces", family: "var(--font-fraunces), ui-serif, serif" },
  {
    id: "grotesk",
    label: "Space Grotesk",
    family: "var(--font-space-grotesk), ui-sans-serif, sans-serif",
  },
  { id: "mono", label: "IBM Plex Mono", family: "var(--font-plex-mono), ui-monospace, monospace" },
  { id: "hand", label: "Caveat", family: "var(--font-caveat), cursive" },
];

/**
 * Resolves a stored key to a font stack.
 *
 * The fallback is load-bearing. Once fonts can be uploaded, deleting one leaves
 * every text box using it pointing at a key that no longer resolves — falling
 * back keeps those pages readable instead of emitting a broken font-family and
 * letting the browser choose.
 */
export const resolveFontFamily = (id: string, fonts: FontOption[] = BUILT_IN_FONTS): string => {
  const match = fonts.find((font) => font.id === id);
  if (match) return match.family;

  const fallback = fonts.find((font) => font.id === DEFAULT_FONT_ID) ?? fonts[0];
  return fallback?.family ?? "ui-sans-serif, sans-serif";
};

/** True when a key can be stored — the guard used before writing to the database. */
export const isKnownFontId = (id: string, fonts: FontOption[] = BUILT_IN_FONTS): boolean =>
  fonts.some((font) => font.id === id);

// ------------------------------------------------------------- uploaded fonts

export type FontFormat = "woff2" | "woff" | "truetype" | "opentype";

export interface UploadedFont {
  /** Server-generated, always prefixed. See `newFontId`. */
  id: string;
  label: string;
  /** The sanitised family name, without quotes. */
  family: string;
  storageKey: string;
  format: FontFormat;
}

const FORMATS: Record<string, FontFormat> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

export const FONT_EXTENSIONS = Object.keys(FORMATS);

/**
 * The @font-face format for a filename, or null if it is not a font.
 *
 * Fonts are gated on the extension rather than `file.type`, because browsers
 * report a font upload as `font/woff2`, `application/font-woff2`,
 * `application/octet-stream` or `""` depending on the operating system. The
 * image routes can trust the mime type; this one cannot.
 */
export const fontFormatFor = (filename: string): FontFormat | null => {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  return FORMATS[filename.slice(dot + 1).toLowerCase()] ?? null;
};

/** The file extension to store a format under. */
export const extensionForFormat = (format: FontFormat): string =>
  Object.keys(FORMATS).find((key) => FORMATS[key] === format) ?? "woff2";

/**
 * A family name safe to place inside a quoted CSS string.
 *
 * The name is interpolated into an @font-face rule that ships in every page's
 * `<style>`, so a label of `Bad"; } body { display: none }` would otherwise
 * break out of the rule and inject arbitrary CSS site-wide.
 */
export const cssFamilyName = (label: string): string => {
  const cleaned = label
    .replace(/[^\p{L}\p{N} _-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned === "" ? "Uploaded font" : cleaned;
};

/**
 * A stable id for a newly uploaded font.
 *
 * Always prefixed and never derived from the filename: a font uploaded as
 * `sans.woff2` must not be able to claim the id `sans` and silently shadow
 * Inter for every text box already using it.
 */
export const newFontId = (): string => `font-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

/** An uploaded font as the registry sees it — a complete stack, like the built-ins. */
export const uploadedFontOption = (font: UploadedFont): FontOption => ({
  id: font.id,
  label: font.label,
  family: `"${font.family}", ui-sans-serif, sans-serif`,
});

/** The list every consumer takes: built-ins first, then whatever the artist added. */
export const mergeFonts = (uploaded: UploadedFont[]): FontOption[] => [
  ...BUILT_IN_FONTS,
  ...uploaded.map(uploadedFontOption),
];

/**
 * The @font-face rules for the uploaded fonts.
 *
 * Emitted once in the root layout's inline `<style>`, alongside the highlight
 * colour, so the public wall, the admin canvas and the toolbar's per-option
 * previews all resolve from one declaration. A face is only fetched when
 * something on the page actually uses it.
 *
 * The seam for a global site face later: this list and `mergeFonts` are both
 * independent of the wall, so a `siteFontId` setting would set `--font-sans`
 * from the same data in the same `<style>` without touching either.
 */
export const fontFaceCss = (fonts: UploadedFont[]): string =>
  fonts
    .map(
      (font) =>
        `@font-face{font-family:"${font.family}";src:url("/media/${font.storageKey}") format("${font.format}");font-display:swap;}`,
    )
    .join("");
