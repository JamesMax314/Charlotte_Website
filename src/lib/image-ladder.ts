import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { WIDTH_LADDER } from "@/image-loader";
import { MODERN_FORMATS, splitExtension, type ModernFormat } from "./image-formats";

/**
 * Rendering the responsive ladder, on the server.
 *
 * This used to happen in the browser: `client-upload.ts` drew the file into a
 * canvas once per rung, encoded each as JPEG and posted four files. It worked,
 * and it was wrong in three ways that all pointed the same direction.
 *
 * **Format.** `canvas.toBlob` can encode JPEG, PNG and (unreliably) WebP, and
 * never AVIF — so the site served JPEG everywhere while the brief's
 * architecture section calls for "AVIF/WebP at breakpoint-appropriate sizes".
 * AVIF is roughly half the bytes at the same visual quality, and on an
 * image-heavy portfolio that is the single largest number on the page.
 *
 * **Quality.** `drawImage` downscaling to a quarter size is a box filter with
 * no mip chain; fine detail in a drawing aliases into it. Cloudflare's
 * resampler does not.
 *
 * **Transport.** Four encodes of the same photograph went up the artist's
 * connection where one had to.
 *
 * The transformation runs in Cloudflare's image service rather than in this
 * Worker's own CPU, which is what makes it affordable on a platform that
 * allows ten milliseconds of it. And it happens once per image, at upload,
 * with the result stored in R2 — never per request. That is the distinction
 * the old comment in `image-loader.ts` missed when it ruled Cloudflare Images
 * out for costing "money per transformation": at four rungs and two formats a
 * fifty-piece catalogue is a few hundred transformations in its lifetime,
 * against a free allowance of thousands a month.
 */

/**
 * Quality per format.
 *
 * AVIF carries more detail per byte, so it is set lower than the JPEG it
 * replaces and still looks better. These are the numbers to move if the artist
 * ever says the work looks soft — not the width ladder, which is decided by
 * the layout.
 */
const QUALITY: Record<string, number> = { avif: 55, webp: 72 };

/** Every rung at or below the original's width. Never upscale. */
export const rungsFor = (naturalWidth: number): number[] =>
  WIDTH_LADDER.filter((width) => width <= naturalWidth);

/**
 * The natural size of an uploaded file, read by the image service.
 *
 * Cheaper and far more robust than decoding it here: `info` reads the header
 * and returns without the Worker touching a pixel, and it understands the
 * formats a browser's `createImageBitmap` does not.
 */
export const measure = async (
  bytes: ArrayBuffer,
): Promise<{ width: number; height: number } | null> => {
  const images = await imageService();
  if (images === null) return null;
  try {
    const info = await images.info(streamOf(bytes));
    // An SVG has no intrinsic pixel size and reports none; the upload routes
    // refuse SVG anyway, so this is belt and braces.
    return "width" in info && "height" in info ? { width: info.width, height: info.height } : null;
  } catch (cause) {
    console.error("[images] could not read the image's dimensions", cause);
    return null;
  }
};

/**
 * One rung in one format.
 *
 * Returns null rather than throwing so a single failed encode costs that
 * encoding and nothing else: the artist gets an image that still works,
 * through `/media`'s fallback chain, rather than an upload that fails whole.
 */
export const render = async (
  bytes: ArrayBuffer,
  { width, format }: { width: number | null; format: ModernFormat },
): Promise<Rendered | null> => {
  const images = await imageService();
  if (images === null) return null;
  try {
    const result = await images
      .input(streamOf(bytes))
      // `scale-down` never enlarges, so a rung wider than the original is a
      // copy rather than a blur — belt and braces beside `rungsFor`.
      .transform(width === null ? {} : { width, fit: "scale-down" })
      .output({ format: format.mime, quality: QUALITY[format.extension] });
    /*
      Collected rather than returned as a stream, and that is not a detail.

      R2's `put` refuses a body whose length it cannot know — "Provided
      readable stream must have a known length" — and the image service's
      output is exactly that. Handing it straight to `put` therefore fails,
      *asynchronously*, at the moment the derivative would have been stored:
      the upload still succeeds, the visitor still gets an image through the
      fallback, and no ladder is ever written. Nothing about the site looks
      broken; it is simply never optimised again.

      A derivative is at most a few hundred kilobytes, so holding one is
      cheap, and a buffer can be handed to a response and to `put` without
      the `tee` that would otherwise be needed for two consumers.
    */
    return {
      bytes: await new Response(result.image()).arrayBuffer(),
      contentType: result.contentType(),
    };
  } catch (cause) {
    console.error(`[images] could not render ${format.extension} at ${width ?? "full"}px`, cause);
    return null;
  }
};

/** A rendered encoding, in hand rather than in flight. See `render`. */
export interface Rendered {
  bytes: ArrayBuffer;
  contentType: string;
}

/**
 * A tiny blurred stand-in, as a data URI.
 *
 * Also moved off the client, so that the whole of "what is stored for this
 * image" is decided in one place. 16px wide is enough to carry the colour and
 * the composition and small enough to sit in a database row and an RSC payload
 * — the value is around a kilobyte, which is why it is worth rendering rather
 * than storing another object.
 */
export const renderLqip = async (bytes: ArrayBuffer): Promise<string | null> => {
  const images = await imageService();
  if (images === null) return null;
  try {
    const result = await images
      .input(streamOf(bytes))
      .transform({ width: 16, fit: "scale-down" })
      // WebP rather than AVIF: an AVIF this small is dominated by its own
      // header, and every browser that reads a data URI reads WebP.
      .output({ format: "image/webp", quality: 40 });
    const encoded = await new Response(result.image({ encoding: "base64" })).text();
    return `data:image/webp;base64,${encoded}`;
  } catch (cause) {
    console.error("[images] could not render the blur placeholder", cause);
    return null;
  }
};

/**
 * Writes the whole ladder for a freshly uploaded base object.
 *
 * Sequential on purpose. Each rung is an image-service call and an R2 write,
 * and firing eight of them at once against the Workers' six-simultaneous-
 * connection ceiling queues them anyway while making a failure harder to
 * attribute. An upload is not a hot path.
 *
 * Every failure is survivable: a rung that does not get written is one
 * `/media` falls back for, so the worst case is a larger image, not a missing
 * one.
 */
export const writeLadder = async (
  storageKey: string,
  bytes: ArrayBuffer,
  naturalWidth: number,
): Promise<void> => {
  const { env } = await getCloudflareContext({ async: true });
  const parts = splitExtension(storageKey);
  if (parts === null) return;

  for (const width of rungsFor(naturalWidth)) {
    for (const format of MODERN_FORMATS) {
      const rendered = await render(bytes, { width, format });
      if (rendered === null) continue;
      await env.MEDIA.put(`${parts.stem}-${width}.${format.extension}`, rendered.bytes, {
        httpMetadata: { contentType: rendered.contentType },
      });
    }
  }
};

/**
 * The image service, or null where it is not bound.
 *
 * `IMAGES` is optional in the generated environment type, and that is worth
 * honouring rather than asserting away: an unbound service must cost the site
 * its optimisation and nothing else. Every caller here degrades to "no
 * derivative was written", which `/media` already handles by falling back to
 * the base object — the same path an image uploaded before the ladder existed
 * takes.
 */
const imageService = async () => {
  const { env } = await getCloudflareContext({ async: true });
  if (env.IMAGES === undefined) {
    console.error("[images] the IMAGES binding is not available; serving originals");
    return null;
  }
  return env.IMAGES;
};

/** A one-shot stream over an ArrayBuffer, which is what the binding takes. */
const streamOf = (bytes: ArrayBuffer): ReadableStream<Uint8Array> =>
  new Blob([bytes]).stream() as ReadableStream<Uint8Array>;
