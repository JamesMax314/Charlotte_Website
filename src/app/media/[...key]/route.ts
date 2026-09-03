import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  baseKeyOf,
  cacheKeyFor,
  preferredFormat,
  splitExtension,
  widthOf,
  withExtension,
} from "@/lib/image-formats";
import { render } from "@/lib/image-ladder";

/**
 * Serves uploaded artwork from R2. The bucket stays private — this is the only
 * way out.
 *
 * Three things happen here that did not before, and each is worth its lines.
 *
 * **The edge cache.** Cloudflare does not cache a Worker's response on its
 * own; only the Cache API puts one there. Without it, every image on every
 * page view for every visitor was a Worker invocation and an R2 read, however
 * immutable the `cache-control` header claimed to be — the browser cache spared
 * a repeat visitor and nobody else. This is the single largest thing standing
 * between a first-time visitor and a fast gallery.
 *
 * **Format negotiation.** A URL names a width; the `Accept` header decides the
 * encoding. next/image builds its srcset from `deviceSizes` and has no way to
 * say "AVIF if you can take it", so one `.jpg` URL stands for the AVIF, WebP
 * and original objects behind it. The chosen format goes in the *cache key*
 * rather than into `Vary`, because Cloudflare's cache honours `Vary` on
 * nothing but `Accept-Encoding` — see the note in `image-formats.ts`.
 *
 * **Streaming.** The body is passed through rather than buffered. `arrayBuffer`
 * held an entire photograph in the isolate to hand it straight back out.
 */

// Reads a binding at request time; never prerendered.
export const dynamic = "force-dynamic";

/** A key's bytes never change, so the answer is good until the heat death. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * The edge cache, resolved per request and never at module scope.
 *
 * Two separate hazards meet on this line.
 *
 * `caches.default` is a Workers extension to `CacheStorage`, and this project
 * compiles against the DOM library — it has to, because half of it is client
 * components — so the standard interface wins and the extension is invisible
 * to TypeScript. Hence the cast, which is the only one in this file.
 *
 * And `caches` does not exist at all while Next collects page data: that runs
 * in plain Node, outside any request, and reading the global there is a
 * `ReferenceError` that fails the build with "Failed to collect configuration
 * for /media/[...key]" and no mention of caching. A function defers the read
 * to a moment when the runtime is real. It also returns null rather than
 * throwing, so the route still serves images anywhere the cache is absent —
 * `next dev`, for one.
 */
const edgeCache = (): Cache | null => {
  const store = globalThis.caches as unknown as { default?: Cache } | undefined;
  return store?.default ?? null;
};

export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const objectKey = key.join("/");

  const format = preferredFormat(request.headers.get("accept"));
  const cacheKey = cacheKeyFor(request.url, format);

  const cache = edgeCache();
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  const { env, ctx } = await getCloudflareContext({ async: true });

  // The negotiated encoding, if it has already been written. The common case
  // once an image has been uploaded or asked for once.
  const wanted = format === null ? null : withExtension(objectKey, format.extension);
  if (wanted !== null && wanted !== objectKey) {
    const hit = await env.MEDIA.get(wanted);
    if (hit) return respond(hit, cacheKey, ctx);
  }

  /*
    Otherwise: exactly what was asked for, then the base object the width was
    derived from. That last fallback is what lets an image stored before the
    ladder existed still resolve at a rung that was never written for it.
  */
  const base = baseKeyOf(objectKey);
  const object =
    (await env.MEDIA.get(objectKey)) ?? (base === null ? null : await env.MEDIA.get(base));
  if (!object) return new Response("Not found", { status: 404 });

  const width = widthOf(objectKey);
  if (format === null || width === null) return respond(object, cacheKey, ctx);

  /*
    A rung the browser can take better, that nobody has rendered yet: make it
    now, serve it, and keep it.

    This is what carries the site's existing photographs across. They were
    uploaded while the *browser* wrote the ladder, so they have JPEG rungs and
    no AVIF at all; without this they would keep their old encodings forever
    and only new work would get the smaller ones. Converting on first request
    means the whole catalogue migrates itself as it is visited, and no backfill
    script has to be written, run, and then kept correct.

    Bounded by construction, because the result is written back to R2: an image
    is transformed once per rung per format for its whole life, not once per
    request.

    The bytes are read into memory here — the one place this route still does
    that — because they have two possible uses. If the render fails, they are
    the response.
  */
  const source = await object.arrayBuffer();
  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
  const rendered = await render(source, { width, format });
  if (rendered === null) return send(streamOf(source), contentType, cacheKey, ctx);

  // Kept, so the next visitor is served rather than transformed for. `render`
  // returns bytes rather than a stream precisely so this `put` can succeed —
  // see the note there.
  const parts = splitExtension(objectKey);
  if (parts !== null) {
    ctx.waitUntil(
      env.MEDIA.put(`${parts.stem}.${format.extension}`, rendered.bytes, {
        httpMetadata: { contentType: rendered.contentType },
      }).then(
        () => undefined,
        (cause: unknown) => {
          // The visitor already has their image; this only means the next one
          // pays for the transformation again.
          console.error("[media] could not store the generated rung", cause);
        },
      ),
    );
  }

  return send(streamOf(rendered.bytes), rendered.contentType, cacheKey, ctx);
}

/** An R2 object, streamed straight through. */
const respond = (object: R2ObjectBody, cacheKey: string, ctx: ExecutionContext): Response =>
  send(
    object.body as ReadableStream<Uint8Array>,
    object.httpMetadata?.contentType ?? "application/octet-stream",
    cacheKey,
    ctx,
    object.httpEtag,
  );

const streamOf = (bytes: ArrayBuffer): ReadableStream<Uint8Array> =>
  new Blob([bytes]).stream() as ReadableStream<Uint8Array>;

/**
 * One response, and a copy of it in the edge cache.
 *
 * `tee` again, for the same reason: `cache.put` consumes the body it is given,
 * so the visitor and the cache each need their own. The put is deferred with
 * `waitUntil` so filling the cache never delays the image that filled it.
 */
function send(
  body: ReadableStream<Uint8Array>,
  contentType: string,
  cacheKey: string,
  ctx: ExecutionContext,
  etag?: string,
): Response {
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": IMMUTABLE,
    // The bucket holds fonts and the site mark as well as artwork, all served
    // same-origin. Pin the declared type so nothing can be sniffed into
    // something the browser would execute.
    "x-content-type-options": "nosniff",
    /*
      Correct for any cache that honours it, and harmless for Cloudflare's,
      which does not — the format is in the cache key instead. A browser's own
      cache and any proxy in between do respect it, and without it one of those
      would hand a visitor's AVIF to the next request from a browser that
      cannot read it.
    */
    vary: "Accept",
  });
  if (etag) headers.set("etag", etag);

  const cache = edgeCache();
  if (cache === null) return new Response(body, { headers });

  const [toVisitor, toCache] = body.tee();
  ctx.waitUntil(cache.put(cacheKey, new Response(toCache, { headers })));
  return new Response(toVisitor, { headers });
}
