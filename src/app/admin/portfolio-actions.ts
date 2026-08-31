"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/catalogue";
import { toSlug, isPlaceholderSlug } from "@/lib/artworks";
import { requireSession } from "@/lib/auth";

/**
 * Portfolio mutations — the home page wall.
 *
 * As in artwork actions, every entry point gates itself: server actions are
 * routed independently of layouts, so the admin layout protects pages only.
 */

const refresh = () => revalidatePath("/", "layout");

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = await getDb();
  const root = toSlug(base) || "untitled";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await db
      .select({ id: schema.portfolioItems.id })
      .from(schema.portfolioItems)
      .where(eq(schema.portfolioItems.slug, candidate))
      .limit(1);
    if (clash.length === 0 || clash[0].id === excludeId) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}

// ---------------------------------------------------------------- home copy

export async function updateHomeCopy(formData: FormData): Promise<void> {
  await requireSession();
  const db = await getDb();

  const values = {
    homeTitle: String(formData.get("homeTitle") ?? "").trim(),
    homeBlurb: String(formData.get("homeBlurb") ?? "").trim(),
  };

  // site_settings is a single row that may not exist yet.
  const existing = await db
    .select({ id: schema.siteSettings.id })
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.id, 1));

  if (existing.length === 0) {
    await db.insert(schema.siteSettings).values({ id: 1, ...values });
  } else {
    await db.update(schema.siteSettings).set(values).where(eq(schema.siteSettings.id, 1));
  }

  refresh();
}

// ---------------------------------------------------------------- pieces

export async function createPortfolioItem(): Promise<void> {
  await requireSession();
  const db = await getDb();

  const id = crypto.randomUUID();
  const [{ nextZ }] = await db
    .select({ nextZ: sql<number>`coalesce(max(${schema.portfolioItems.z}), 0) + 1` })
    .from(schema.portfolioItems);

  await db.insert(schema.portfolioItems).values({
    id,
    slug: await uniqueSlug("Untitled"),
    name: "Untitled",
    // Dropped near the top-left at a modest size; the artist moves it from there.
    x: 4,
    y: 4,
    width: 28,
    z: nextZ,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  redirect(`/admin/portfolio/${id}`);
}

export async function updatePortfolioItem(id: string, formData: FormData): Promise<void> {
  await requireSession();
  const db = await getDb();

  const name = String(formData.get("name") ?? "").trim() || "Untitled";
  const submittedSlug = String(formData.get("slug") ?? "").trim();
  // Same rule as artworks: a placeholder slug follows the name, an edited one is hers.
  const slugSource = !submittedSlug || isPlaceholderSlug(submittedSlug) ? name : submittedSlug;

  await db
    .update(schema.portfolioItems)
    .set({
      name,
      slug: await uniqueSlug(slugSource, id),
      information: String(formData.get("information") ?? "").trim(),
      status: String(formData.get("status") ?? "published") as "draft" | "published",
      updatedAt: new Date(),
    })
    .where(eq(schema.portfolioItems.id, id));

  refresh();
}

/**
 * Persists a drag or resize.
 *
 * Called on pointer release rather than on every frame — the canvas updates
 * optimistically, so this only has to record where the piece came to rest.
 */
export async function savePortfolioLayout(
  id: string,
  layout: { x: number; y: number; width: number },
): Promise<void> {
  await requireSession();
  const db = await getDb();

  await db
    .update(schema.portfolioItems)
    .set({
      // Clamped server-side too: a hand-crafted request must not be able to
      // push a piece off the wall or give it a zero width.
      x: Math.min(Math.max(layout.x, -20), 120),
      y: Math.max(layout.y, 0),
      width: Math.min(Math.max(layout.width, 5), 100),
      updatedAt: new Date(),
    })
    .where(eq(schema.portfolioItems.id, id));

  refresh();
}

/** Brings a piece to the front, so overlapping work can be reordered. */
export async function bringPortfolioItemToFront(id: string): Promise<void> {
  await requireSession();
  const db = await getDb();
  const [{ topZ }] = await db
    .select({ topZ: sql<number>`coalesce(max(${schema.portfolioItems.z}), 0) + 1` })
    .from(schema.portfolioItems);
  await db
    .update(schema.portfolioItems)
    .set({ z: topZ, updatedAt: new Date() })
    .where(eq(schema.portfolioItems.id, id));
  refresh();
}

export async function deletePortfolioItem(id: string): Promise<void> {
  await requireSession();
  const db = await getDb();

  // Remove the R2 objects too, or the bucket accumulates orphans forever.
  const images = await db
    .select({ storageKey: schema.portfolioImages.storageKey })
    .from(schema.portfolioImages)
    .where(eq(schema.portfolioImages.itemId, id));

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  await Promise.all(images.map((i) => env.MEDIA.delete(i.storageKey)));

  await db.delete(schema.portfolioItems).where(eq(schema.portfolioItems.id, id));
  refresh();
  redirect("/admin/portfolio");
}

// ---------------------------------------------------------------- images

export async function reorderPortfolioImages(itemId: string, ids: string[]): Promise<void> {
  await requireSession();
  if (ids.length === 0) return;

  const db = await getDb();
  const cases = ids.map((id, index) => sql`when ${id} then ${index}`);

  await db
    .update(schema.portfolioImages)
    .set({ sortOrder: sql`case ${schema.portfolioImages.id} ${sql.join(cases, sql` `)} end` })
    .where(and(eq(schema.portfolioImages.itemId, itemId), inArray(schema.portfolioImages.id, ids)));

  refresh();
}

export async function updatePortfolioImageAlt(id: string, alt: string): Promise<void> {
  await requireSession();
  const db = await getDb();
  await db
    .update(schema.portfolioImages)
    .set({ alt: alt.trim() })
    .where(eq(schema.portfolioImages.id, id));
  refresh();
}

export async function deletePortfolioImage(id: string): Promise<void> {
  await requireSession();
  const db = await getDb();

  const rows = await db
    .select({ storageKey: schema.portfolioImages.storageKey })
    .from(schema.portfolioImages)
    .where(eq(schema.portfolioImages.id, id))
    .limit(1);

  if (rows.length > 0) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    await env.MEDIA.delete(rows[0].storageKey);
  }

  await db.delete(schema.portfolioImages).where(eq(schema.portfolioImages.id, id));
  refresh();
}
