/**
 * Custom next/image loader.
 *
 * There is no image optimizer on Cloudflare Workers — `/_next/image` 404s — and
 * Cloudflare Images costs money per transformation. Instead the browser writes a
 * fixed ladder of widths at upload time, and this loader addresses them by
 * convention: /media/artworks/<hash>.jpg → /media/artworks/<hash>-800.jpg
 *
 * The /media route falls back to the base object when a derivative is absent, so
 * images uploaded before the ladder existed still resolve.
 */
/**
 * The widths written at upload. `images.deviceSizes` in next.config.ts must
 * match this exactly, or the browser picks a width that does not exist and the
 * rounding here silently doubles it.
 */
export const WIDTH_LADDER = [400, 800, 1600, 2400] as const;

export default function mediaLoader({ src, width }: { src: string; width: number }): string {
  if (!src.startsWith("/media/")) return src;

  const target = WIDTH_LADDER.find((w) => w >= width) ?? WIDTH_LADDER[WIDTH_LADDER.length - 1];
  const dot = src.lastIndexOf(".");
  if (dot === -1) return src;

  return `${src.slice(0, dot)}-${target}${src.slice(dot)}`;
}
