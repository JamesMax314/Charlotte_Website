import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/catalogue";
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
  const artworkId = String(form.get("artworkId") ?? "");

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
  const owner = await db
    .select({ id: schema.artworks.id, title: schema.artworks.title })
    .from(schema.artworks)
    .where(eq(schema.artworks.id, artworkId))
    .limit(1);

  if (owner.length === 0) {
    return Response.json({ error: "Unknown artwork." }, { status: 404 });
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

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.artworkImages.sortOrder}), -1) + 1` })
    .from(schema.artworkImages)
    .where(eq(schema.artworkImages.artworkId, artworkId));

  const id = crypto.randomUUID();
  await db.insert(schema.artworkImages).values({
    id,
    artworkId,
    storageKey,
    // Alt text is required to publish; seed it from the title so the field is
    // never a blank wall, and let the artist correct it.
    alt: String(form.get("alt") ?? "").trim() || owner[0].title,
    width: Number(form.get("width")) || 0,
    height: Number(form.get("height")) || 0,
    lqip: String(form.get("lqip") ?? "") || null,
    sortOrder: next,
  });

  return Response.json({ id, src: `/media/${storageKey}` });
}
