import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { claimMedia } from "@/lib/publish";
import { hasValidSession } from "@/lib/auth";
import { assetKey, contentHash, IMAGE_EXTENSIONS } from "@/lib/storage";
import { measure, renderLqip, writeLadder } from "@/lib/image-ladder";

export const dynamic = "force-dynamic";

/**
 * One image, from the artist's machine into R2 and the database.
 *
 * The browser used to do the resizing and post four files. It now posts one —
 * the original, downscaled only when it is too large to send at all — and
 * every derivative is rendered here, by Cloudflare's image service, in AVIF
 * and WebP. `src/lib/image-ladder.ts` has the reasoning.
 */

/** Generous, because the browser only reduces a file that exceeds its own cap. */
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  // Route handlers bypass layouts, so this gates itself.
  if (!(await hasValidSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  // One upload path serves both collections: the store (artworks) and the
  // portfolio. They are separate tables but the R2 write is identical.
  const artworkId = String(form.get("artworkId") ?? "");
  const portfolioItemId = String(form.get("portfolioItemId") ?? "");
  if (!artworkId && !portfolioItemId) {
    return Response.json({ error: "No destination given." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: `Unsupported image type ${file.type}.` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That image is too large." }, { status: 413 });
  }

  const db = await getDb();
  const owner = artworkId
    ? await db
        .select({ id: schema.artworks.id, title: schema.artworks.title })
        .from(schema.artworks)
        .where(eq(schema.artworks.id, artworkId))
        .limit(1)
    : await db
        .select({ id: schema.portfolioItems.id, title: schema.portfolioItems.name })
        .from(schema.portfolioItems)
        .where(eq(schema.portfolioItems.id, portfolioItemId))
        .limit(1);

  if (owner.length === 0) {
    return Response.json({ error: "Unknown destination." }, { status: 404 });
  }

  const bytes = await file.arrayBuffer();

  // Content-addressed: identical bytes reuse a key, and a key's bytes never
  // change, which is what makes /media safe to cache immutably.
  const hash = await contentHash(bytes);
  const storageKey = assetKey("artworks", hash, IMAGE_EXTENSIONS[file.type]);

  const { env, ctx } = await getCloudflareContext({ async: true });
  await env.MEDIA.put(storageKey, bytes, { httpMetadata: { contentType: file.type } });

  // The same bytes always produce the same key, so this upload may be reviving
  // one a delete had queued for removal. See claimMedia.
  await claimMedia([storageKey]);

  /*
    Two transformations before the response, and up to eight after it.

    The size and the blur placeholder are columns on the row this request is
    about to write, so they have to be in hand. The width ladder is not: an
    image whose derivatives have not appeared yet resolves through /media's
    fallback to the base object, so the artist sees her photograph on the wall
    immediately and the smaller encodings arrive behind her. Making her wait
    for eight encodes to see one picture is the wrong trade, and it is also
    the one that risks the request outliving its own limits.
  */
  const measured = await measure(bytes);
  const width = measured?.width ?? Number(form.get("width")) ?? 0;
  const height = measured?.height ?? Number(form.get("height")) ?? 0;
  const lqip = await renderLqip(bytes);

  ctx.waitUntil(writeLadder(storageKey, bytes, width));

  const id = crypto.randomUUID();
  // Alt text is required to publish; seed it from the title so the field is
  // never a blank wall, and let the artist correct it.
  const shared = {
    id,
    storageKey,
    alt: String(form.get("alt") ?? "").trim() || owner[0].title,
    width,
    height,
    lqip,
  };

  if (artworkId) {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${schema.artworkImages.sortOrder}), -1) + 1` })
      .from(schema.artworkImages)
      .where(eq(schema.artworkImages.artworkId, artworkId));
    await db.insert(schema.artworkImages).values({ ...shared, artworkId, sortOrder: next });
  } else {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${schema.portfolioImages.sortOrder}), -1) + 1` })
      .from(schema.portfolioImages)
      .where(eq(schema.portfolioImages.itemId, portfolioItemId));
    await db
      .insert(schema.portfolioImages)
      .values({ ...shared, itemId: portfolioItemId, sortOrder: next });
  }

  return Response.json({ id, src: `/media/${storageKey}`, width, height });
}
