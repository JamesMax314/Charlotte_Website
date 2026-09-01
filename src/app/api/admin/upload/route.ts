import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { claimMedia } from "@/lib/publish";
import { hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Client downscales before upload; this is a backstop, not the primary limit. */
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

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
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const storageKey = `artworks/${hash}.${EXTENSIONS[file.type]}`;

  const { env } = await getCloudflareContext({ async: true });
  await env.MEDIA.put(storageKey, bytes, { httpMetadata: { contentType: file.type } });

  // The same bytes always produce the same key, so this upload may be reviving
  // one a delete had queued for removal. See claimMedia.
  await claimMedia([storageKey]);

  // Responsive derivatives, rendered in the browser. Keyed by convention so
  // src/image-loader.ts can address them without a database lookup.
  const extension = EXTENSIONS[file.type];
  await Promise.all(
    Array.from(form.entries())
      .filter(([name, value]) => name.startsWith("variant-") && value instanceof File)
      .map(async ([name, value]) => {
        const width = name.slice("variant-".length);
        await env.MEDIA.put(
          `artworks/${hash}-${width}.${extension}`,
          await (value as File).arrayBuffer(),
          {
            httpMetadata: { contentType: file.type },
          },
        );
      }),
  );

  const id = crypto.randomUUID();
  // Alt text is required to publish; seed it from the title so the field is
  // never a blank wall, and let the artist correct it.
  const shared = {
    id,
    storageKey,
    alt: String(form.get("alt") ?? "").trim() || owner[0].title,
    width: Number(form.get("width")) || 0,
    height: Number(form.get("height")) || 0,
    lqip: String(form.get("lqip") ?? "") || null,
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

  return Response.json({ id, src: `/media/${storageKey}` });
}
