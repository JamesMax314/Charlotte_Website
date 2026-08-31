import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Serves uploaded artwork from R2.
 *
 * The bucket stays private — this route is the only way out. Object keys are
 * content hashed at upload, so a key's bytes never change and the response can
 * be cached immutably.
 */

// Reads a binding at request time; never prerendered.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const objectKey = key.join("/");

  const { env } = await getCloudflareContext({ async: true });
  let object = await env.MEDIA.get(objectKey);

  // Fall back to the base object when a ladder derivative is missing, so images
  // stored before the responsive ladder existed still resolve.
  if (!object) {
    const base = objectKey.replace(/-(\d+)(\.[a-z0-9]+)$/i, "$2");
    if (base !== objectKey) object = await env.MEDIA.get(base);
  }

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("content-type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // Buffered rather than streamed: R2 stream bodies do not survive OpenNext's
  // dev binding proxy. Uploads are downscaled client-side, so objects are small.
  return new Response(await object.arrayBuffer(), { headers });
}
