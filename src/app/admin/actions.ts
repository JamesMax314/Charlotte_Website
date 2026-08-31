"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/catalogue";
import { isValidEtsyUrl, toSlug } from "@/lib/artworks";
import { SESSION_COOKIE, checkPassphrase, createSessionValue, requireSession } from "@/lib/auth";

/**
 * Every mutating action gates itself with requireSession(). Server actions are
 * routed independently of layouts, so the admin layout's check protects pages
 * only — never the actions.
 */

function refreshPublicPages() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- auth

export async function login(_prev: { error?: string }, formData: FormData) {
  const passphrase = String(formData.get("passphrase") ?? "");

  if (!(await checkPassphrase(passphrase))) {
    // Slows down guessing without needing shared state between isolates.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { error: "That passphrase is not right." };
  }

  const { value, expires } = await createSessionValue();
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------------------------------------------------------------- artworks

/** Keeps slugs unique by suffixing, so two "Untitled" pieces can coexist. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = await getDb();
  const root = toSlug(base) || "untitled";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await db
      .select({ id: schema.artworks.id })
      .from(schema.artworks)
      .where(eq(schema.artworks.slug, candidate))
      .limit(1);
    if (clash.length === 0 || clash[0].id === excludeId) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createArtwork(formData: FormData) {
  await requireSession();
  const db = await getDb();

  const title = String(formData.get("title") ?? "").trim() || "Untitled";
  const id = crypto.randomUUID();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.artworks.sortOrder}), 0) + 1` })
    .from(schema.artworks);

  await db.insert(schema.artworks).values({
    id,
    slug: await uniqueSlug(title),
    title,
    year: Number(formData.get("year")) || new Date().getFullYear(),
    medium: String(formData.get("medium") ?? "").trim(),
    description: "",
    status: "draft",
    sortOrder: next,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  redirect(`/admin/artworks/${id}`);
}

export async function updateArtwork(id: string, formData: FormData): Promise<void> {
  await requireSession();
  const db = await getDb();

  const title = String(formData.get("title") ?? "").trim() || "Untitled";
  const status = String(formData.get("status") ?? "draft") as schema.ArtworkRow["status"];

  await db
    .update(schema.artworks)
    .set({
      title,
      slug: await uniqueSlug(String(formData.get("slug") || title), id),
      year: Number(formData.get("year")) || new Date().getFullYear(),
      medium: String(formData.get("medium") ?? "").trim(),
      dimensionsNote: String(formData.get("dimensionsNote") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim(),
      status,
      isFeatured: formData.get("isFeatured") === "on",
      updatedAt: new Date(),
    })
    .where(eq(schema.artworks.id, id));

  refreshPublicPages();
}

/**
 * Archive rather than delete. Archived work keeps a live URL; permanent
 * deletion is a separate, explicit action.
 */
export async function archiveArtwork(id: string) {
  await requireSession();
  const db = await getDb();
  await db
    .update(schema.artworks)
    .set({ status: "archived", isFeatured: false, updatedAt: new Date() })
    .where(eq(schema.artworks.id, id));
  refreshPublicPages();
}

export async function deleteArtworkPermanently(id: string) {
  await requireSession();
  const db = await getDb();

  // Remove the R2 objects too, or the bucket accumulates orphans forever.
  const images = await db
    .select({ storageKey: schema.artworkImages.storageKey })
    .from(schema.artworkImages)
    .where(eq(schema.artworkImages.artworkId, id));

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  await Promise.all(images.map((i) => env.MEDIA.delete(i.storageKey)));

  await db.delete(schema.artworks).where(eq(schema.artworks.id, id));
  refreshPublicPages();
  redirect("/admin");
}

/**
 * Persists the order produced by the drag-to-arrange view.
 *
 * One CASE statement rather than a write per row: the whole reorder lands
 * atomically in a single D1 round trip, so a dropped connection can never
 * leave the gallery half-reordered.
 */
export async function reorderArtworks(ids: string[]) {
  await requireSession();
  if (ids.length === 0) return;

  const db = await getDb();
  const cases = ids.map((id, index) => sql`when ${id} then ${index + 1}`);

  await db
    .update(schema.artworks)
    .set({
      sortOrder: sql`case ${schema.artworks.id} ${sql.join(cases, sql` `)} end`,
      updatedAt: new Date(),
    })
    .where(inArray(schema.artworks.id, ids));

  refreshPublicPages();
}

export async function setFeatured(id: string, isFeatured: boolean) {
  await requireSession();
  const db = await getDb();
  await db
    .update(schema.artworks)
    .set({ isFeatured, updatedAt: new Date() })
    .where(eq(schema.artworks.id, id));
  refreshPublicPages();
}

// ---------------------------------------------------------------- images

export async function reorderImages(artworkId: string, ids: string[]) {
  await requireSession();
  if (ids.length === 0) return;

  const db = await getDb();
  const cases = ids.map((id, index) => sql`when ${id} then ${index}`);

  await db
    .update(schema.artworkImages)
    .set({ sortOrder: sql`case ${schema.artworkImages.id} ${sql.join(cases, sql` `)} end` })
    .where(
      and(eq(schema.artworkImages.artworkId, artworkId), inArray(schema.artworkImages.id, ids)),
    );

  refreshPublicPages();
}

export async function updateImageAlt(id: string, alt: string) {
  await requireSession();
  const db = await getDb();
  await db
    .update(schema.artworkImages)
    .set({ alt: alt.trim() })
    .where(eq(schema.artworkImages.id, id));
  refreshPublicPages();
}

export async function deleteImage(id: string) {
  await requireSession();
  const db = await getDb();

  const rows = await db
    .select({ storageKey: schema.artworkImages.storageKey })
    .from(schema.artworkImages)
    .where(eq(schema.artworkImages.id, id))
    .limit(1);

  if (rows.length > 0) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    await env.MEDIA.delete(rows[0].storageKey);
  }

  await db.delete(schema.artworkImages).where(eq(schema.artworkImages.id, id));
  refreshPublicPages();
}

// ---------------------------------------------------------------- listings

export async function saveListing(
  artworkId: string,
  _prev: { error?: string },
  formData: FormData,
) {
  await requireSession();
  const db = await getDb();

  const etsyUrl = String(formData.get("etsyUrl") ?? "").trim();
  if (!isValidEtsyUrl(etsyUrl)) {
    return { error: "That is not an https etsy.com link." };
  }

  const pounds = Number(formData.get("price"));
  if (!Number.isFinite(pounds) || pounds < 0) {
    return { error: "Enter a price in pounds, like 45 or 62.50." };
  }

  const editionSize = formData.get("editionSize");
  const editionRemaining = formData.get("editionRemaining");
  const existingId = String(formData.get("listingId") ?? "");

  const values = {
    artworkId,
    kind: String(formData.get("kind") ?? "print") as schema.ListingRow["kind"],
    label: String(formData.get("label") ?? "").trim() || "Print",
    etsyUrl,
    // Money is integer pence everywhere; round rather than trusting float maths.
    pricePence: Math.round(pounds * 100),
    availability: String(
      formData.get("availability") ?? "available",
    ) as schema.ListingRow["availability"],
    editionSize: editionSize ? Number(editionSize) : null,
    editionRemaining: editionRemaining ? Number(editionRemaining) : null,
    sortOrder: Number(formData.get("sortOrder")) || 0,
  };

  if (existingId) {
    await db.update(schema.listings).set(values).where(eq(schema.listings.id, existingId));
  } else {
    await db.insert(schema.listings).values({ id: crypto.randomUUID(), ...values });
  }

  refreshPublicPages();
  return { ok: true as const };
}

export async function deleteListing(id: string) {
  await requireSession();
  const db = await getDb();
  await db.delete(schema.listings).where(eq(schema.listings.id, id));
  refreshPublicPages();
}
