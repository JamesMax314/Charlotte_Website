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
