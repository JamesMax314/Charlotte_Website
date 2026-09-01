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
 * The width-ladder derivatives that accompany a base key.
 *
 * Deletes have only ever removed the base object, orphaning `-400` and `-800`
 * in the bucket. New code paths delete both.
 */
export const derivativeKeys = (storageKey: string, widths: readonly number[]): string[] => {
  const dot = storageKey.lastIndexOf(".");
  if (dot === -1) return [];
  return widths.map((width) => `${storageKey.slice(0, dot)}-${width}${storageKey.slice(dot)}`);
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
