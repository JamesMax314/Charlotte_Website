/**
 * Which bytes answer a request for an image, and what they are called in R2.
 *
 * Pure and binding-free, like `storage.ts` beside it, because the naming
 * convention is the whole contract between three parts that never meet:
 * `src/image-loader.ts` builds the URL in the browser, the upload route writes
 * the objects, and `/media` resolves one to the other.
 *
 * The rule: **a URL asks for a width, not for a format.** next/image's srcset
 * is built from `deviceSizes` and cannot express "AVIF if you can take it", so
 * the loader keeps emitting the original extension and `/media` decides the
 * encoding from the request's `Accept` header. One URL per width, several
 * objects behind it.
 */

/**
 * The formats the pipeline writes, best first.
 *
 * AVIF is roughly half the bytes of a JPEG at the same visual quality and
 * WebP about two thirds, which is what the brief means by "AVIF/WebP at
 * breakpoint-appropriate sizes" — a requirement the browser-side JPEG encoder
 * could not meet at all, since `canvas.toBlob` supports neither.
 */
export const MODERN_FORMATS = [
  { extension: "avif", mime: "image/avif" },
  { extension: "webp", mime: "image/webp" },
] as const;

export type ModernFormat = (typeof MODERN_FORMATS)[number];

/**
 * Splits a key into the part before the extension and the extension itself.
 *
 * Returns null for a key with no extension, which `isSafeKey` already refuses
 * — this is here so every caller handles the case rather than indexing into
 * `-1`.
 */
export const splitExtension = (key: string): { stem: string; extension: string } | null => {
  const dot = key.lastIndexOf(".");
  if (dot <= 0 || dot === key.length - 1) return null;
  return { stem: key.slice(0, dot), extension: key.slice(dot + 1).toLowerCase() };
};

/** `artworks/ab12-800.jpg` → `artworks/ab12-800.avif`. */
export const withExtension = (key: string, extension: string): string => {
  const parts = splitExtension(key);
  return parts === null ? key : `${parts.stem}.${extension}`;
};

/**
 * The base object a width-ladder key was derived from, or null if it is
 * already a base key.
 *
 * `artworks/ab12-800.jpg` → `artworks/ab12.jpg`. The trailing `-<digits>` is
 * the only thing that marks a derivative, which is why a content hash is hex
 * and never ends in one.
 */
export const baseKeyOf = (key: string): string | null => {
  const base = key.replace(/-(\d+)(\.[a-z0-9]+)$/i, "$2");
  return base === key ? null : base;
};

/** The width a ladder key asks for, or null if it is a base key. */
export const widthOf = (key: string): number | null => {
  const match = /-(\d+)\.[a-z0-9]+$/i.exec(key);
  return match === null ? null : Number(match[1]);
};

/**
 * The best format this browser will take, or null for one that wants the
 * original.
 *
 * A deliberately loose test. `Accept` is a list with optional quality values
 * and browsers write it inconsistently, but every browser that can decode AVIF
 * names it, and one that cannot never does — so a substring is the whole of
 * what needs asking. Reading `q=0` as acceptance is the one way this is wrong,
 * and no browser sends it.
 */
export const preferredFormat = (accept: string | null): ModernFormat | null => {
  if (accept === null) return null;
  const header = accept.toLowerCase();
  return MODERN_FORMATS.find((format) => header.includes(format.mime)) ?? null;
};

/**
 * The cache key for a negotiated response.
 *
 * Cloudflare's edge cache does not honour `Vary` on anything but
 * `Accept-Encoding`, so a single cached entry for `-800.jpg` would be handed
 * to the next visitor whatever their browser can decode — AVIF bytes to a
 * browser that asked for JPEG, under a `.jpg` URL, which renders as a broken
 * image and is invisible in testing because the machine testing it accepts
 * AVIF. Putting the format in the cache key gives each encoding its own entry
 * and removes the need for `Vary` to be respected at all.
 */
export const cacheKeyFor = (url: string, format: ModernFormat | null): string => {
  const target = new URL(url);
  target.search = format === null ? "" : `?fmt=${format.extension}`;
  return target.toString();
};
