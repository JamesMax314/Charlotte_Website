"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { ListingRow } from "@/db/schema";
import { getDb } from "@/lib/catalogue";
import {
  isPlaceholderSlug,
  isValidEtsyUrl,
  toSlug,
  type ArtworkDetails,
  type ArtworkStatus,
} from "@/lib/artworks";
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

/**
 * A piece to hang the dialog on.
 *
 * The row has to exist before an image can be attached to it, so adding a
 * piece creates a draft and hands back its id — cancelling the dialog deletes
 * it again, which is the only thing standing between this flow and a database
 * full of empty pieces. Deliberately does not revalidate or navigate: nothing
 * public has changed yet, and the artist must stay on the grid.
 */
export async function createArtworkDraft(): Promise<string> {
  await requireSession();
  const db = await getDb();

  const id = crypto.randomUUID();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.artworks.sortOrder}), 0) + 1` })
    .from(schema.artworks);

  await db.insert(schema.artworks).values({
    id,
    slug: await uniqueSlug("Untitled"),
    title: "Untitled",
    year: new Date().getFullYear(),
    medium: "",
    description: "",
    status: "draft",
    sortOrder: next,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return id;
}

/**
 * Saves the whole piece — the artwork row and the one thing it sells.
 *
 * The store sells a single product per piece, so the listing is upserted
 * alongside the artwork rather than managed separately. An empty Etsy link is
 * how the artist says the piece is shown but not sold (brief P-07): the
 * listing goes, and the buy panel with it. Any extra listings from the old
 * multi-size editor are left untouched and simply no longer offered.
 */
export async function saveArtworkDetails(
  id: string,
  details: ArtworkDetails,
): Promise<{ error?: string }> {
  await requireSession();
  const db = await getDb();

  const title = details.title.trim() || "Untitled";
  const etsyUrl = details.etsyUrl.trim();
  const pounds = Number(details.price);

  if (etsyUrl && !isValidEtsyUrl(etsyUrl)) {
    return { error: "That is not an https etsy.com link." };
  }
  if (etsyUrl && (!Number.isFinite(pounds) || pounds < 0)) {
    return { error: "Enter a price in pounds, like 45 or 62.50." };
  }

  // A slug still on its placeholder follows the title; one the artist has
  // edited deliberately is left alone.
  const submittedSlug = details.slug.trim();
  const slugSource = !submittedSlug || isPlaceholderSlug(submittedSlug) ? title : submittedSlug;

  await db
    .update(schema.artworks)
    .set({
      title,
      slug: await uniqueSlug(slugSource, id),
      year: Number(details.year) || new Date().getFullYear(),
      medium: details.medium.trim(),
      dimensionsNote: details.dimensionsNote.trim() || null,
      description: details.description.trim(),
      status: details.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.artworks.id, id));

  const existing = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(eq(schema.listings.artworkId, id))
    .orderBy(schema.listings.sortOrder)
    .limit(1);

  if (!etsyUrl) {
    if (existing.length > 0) {
      await db.delete(schema.listings).where(eq(schema.listings.id, existing[0].id));
    }
  } else {
    const values = {
      artworkId: id,
      label: details.label.trim(),
      etsyUrl,
      // Money is integer pence everywhere; round rather than trusting floats.
      pricePence: Math.round(pounds * 100),
      availability: (details.soldOut ? "sold_out" : "available") as ListingRow["availability"],
      sortOrder: 0,
    };

    if (existing.length > 0) {
      await db.update(schema.listings).set(values).where(eq(schema.listings.id, existing[0].id));
    } else {
      await db.insert(schema.listings).values({ id: crypto.randomUUID(), ...values });
    }
  }

  refreshPublicPages();
  return {};
}

/** Draft, published or archived, from the grid's right-click menu. */
export async function setArtworkStatus(id: string, status: ArtworkStatus) {
  await requireSession();
  const db = await getDb();
  await db
    .update(schema.artworks)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.artworks.id, id));
  refreshPublicPages();
}

/**
 * Sold out, from the grid, without opening the piece.
 *
 * Availability lives on the listing, so a piece with nothing listed has no
 * sold-out state to toggle — the update simply matches no rows.
 */
export async function setArtworkSoldOut(id: string, soldOut: boolean) {
  await requireSession();
  const db = await getDb();
  await db
    .update(schema.listings)
    .set({ availability: soldOut ? "sold_out" : "available" })
    .where(eq(schema.listings.artworkId, id));
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
