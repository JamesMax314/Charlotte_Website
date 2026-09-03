import { MODERN_FORMATS } from "./image-formats";

/**
 * R2 key arithmetic, shared by every upload path.
 *
 * Pure and binding-free so the rules are unit-testable: `crypto.subtle` is
 * present in both Workers and Node, so even the hash runs under Vitest.
 */

/** Extensions the image pipeline writes, keyed by the mime it accepts. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Content-addressed key fragment: the first 8 bytes of SHA-256, as hex.
 *
 * Identical bytes reuse a key and a key's bytes never change, which is what
 * makes /media safe to cache immutably — and what makes a re-uploaded favicon
 * land on a new URL, sidestepping the browser's notoriously sticky icon cache.
 */
export const contentHash = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const assetKey = (prefix: string, hash: string, extension: string): string =>
  `${prefix}/${hash}.${extension}`;

/**
 * Every object that accompanies a base key: each rung, in each encoding.
 *
 * A rung exists in up to three forms — the original extension, written by the
 * upload, and one per modern format, written either at upload or by `/media`
 * the first time a browser asks for it. All of them have to be named here,
 * because this is the only list a delete consults.
 *
 * The failure when a form is missing from it has happened twice now. First the
 * deletes removed the base object alone and left `-400` and `-800` in the
 * bucket forever; then AVIF and WebP arrived and this function still described
 * only the original extension, so the encodings that make up most of the
 * bucket's objects were the ones never swept. Both leaks are silent: nothing
 * reads an orphan, nothing reports it, and the only symptom is a bill.
 *
 * Over-naming is free — R2's delete ignores a key that is not there — so a
 * format that turns out never to have been written costs nothing, while one
 * that is omitted leaks for good.
 */
export const derivativeKeys = (storageKey: string, widths: readonly number[]): string[] => {
  const dot = storageKey.lastIndexOf(".");
  if (dot === -1) return [];

  const stem = storageKey.slice(0, dot);
  const original = storageKey.slice(dot);
  // De-duplicated, because a source that is *already* one of the modern
  // formats — a WebP upload, a WebP mark — would otherwise have its own
  // extension named twice.
  return [
    ...new Set(
      widths.flatMap((width) => [
        `${stem}-${width}${original}`,
        ...MODERN_FORMATS.map((format) => `${stem}-${width}.${format.extension}`),
      ]),
    ),
  ];
};

/**
 * Whether a stored key is safe to hand to R2.
 *
 * Keys always come from `assetKey`, so this guards against a value that has
 * been round-tripped through the database rather than against user input —
 * cheap insurance on a path that ends in a delete.
 */
export const isSafeKey = (key: string): boolean =>
  key.length > 0 &&
  key.length <= 200 &&
  !key.startsWith("/") &&
  !key.includes("..") &&
  /^[a-z0-9/_-]+\.[a-z0-9]+$/i.test(key);

/**
 * The keys from a list that are safe to hand to R2, de-duplicated.
 *
 * Shared by the two sides of the media deletion queue — `releaseMedia` and
 * `claimMedia` in src/lib/publish.ts — so the pair cannot disagree about which
 * keys they act on. A key one of them skipped and the other did not would
 * either strand a row in the queue or delete an object still in use.
 */
export const usableKeys = (keys: (string | null | undefined)[]): string[] => [
  ...new Set(keys.filter((key): key is string => typeof key === "string" && isSafeKey(key))),
];
