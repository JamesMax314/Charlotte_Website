"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/catalogue";
import { toSlug, isPlaceholderSlug } from "@/lib/artworks";
import { isKnownFontId, mergeFonts } from "@/lib/fonts";
import { docFromPlain, docToPlain, sanitiseDoc, serialiseDoc } from "@/lib/rich-text";
import { requireSession } from "@/lib/auth";
import { HOME_WALL, scopeColumns, type WallScope } from "@/lib/portfolio";
import { getSiteFonts, upsertSiteSettings } from "@/lib/site-settings";

/**
 * Portfolio mutations — the home page wall.
 *
 * As in artwork actions, every entry point gates itself: server actions are
 * routed independently of layouts, so the admin layout protects pages only.
 */

const refresh = () => revalidatePath("/", "layout");

async function uniqueSlug(base: string, excludeId?: string, id?: string): Promise<string> {
  const db = await getDb();
  // A piece may legitimately have no title — an icon or a decorative mark — so
  // fall back to something derived from its id rather than a wall of
  // "untitled-7" slugs.
  const root = toSlug(base) || (id ? `piece-${id.slice(0, 8)}` : "untitled");
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

/**
 * How the wall behaves. Saved one field at a time so the toggles can apply
 * immediately rather than behind a Save button.
 */
export async function updatePageSettings(patch: {
  gutterEnabled?: boolean;
  gutter?: number;
  snapEnabled?: boolean;
  showNamesOnHover?: boolean;
  contentFadeIn?: boolean;
}): Promise<void> {
  await requireSession();

  const values = {
    ...(patch.gutterEnabled === undefined ? {} : { gutterEnabled: patch.gutterEnabled }),
    // A gutter wider than a fifth of the wall is not a gutter any more.
    ...(patch.gutter === undefined ? {} : { gutter: Math.min(Math.max(patch.gutter, 0), 20) }),
    ...(patch.snapEnabled === undefined ? {} : { snapEnabled: patch.snapEnabled }),
    ...(patch.showNamesOnHover === undefined ? {} : { showNamesOnHover: patch.showNamesOnHover }),
    ...(patch.contentFadeIn === undefined ? {} : { contentFadeIn: patch.contentFadeIn }),
  };
  await upsertSiteSettings(values);
  refresh();
}

// ---------------------------------------------------------------- pieces

/**
 * Creates an empty piece and returns its id, without navigating.
 *
 * The artist picks a file first and the details dialog opens over the wall, so
 * the row has to exist before the image can be attached to it. Cancelling the
 * dialog deletes it again.
 */
export async function createPortfolioItemDraft(
  at?: { x: number; y: number },
  scope: WallScope = HOME_WALL,
): Promise<string> {
  await requireSession();
  const db = await getDb();

  const id = crypto.randomUUID();
  const [{ nextZ }] = await db
    .select({ nextZ: sql<number>`coalesce(max(${schema.portfolioItems.z}), 0) + 1` })
    .from(schema.portfolioItems);

  await db.insert(schema.portfolioItems).values({
    id,
    slug: await uniqueSlug("", undefined, id),
    name: "",
    ...scopeColumns(scope),
    // Elements on a piece's own page never link anywhere. A custom page is a
    // wall, not a piece's page, so work shown there is clickable as at home.
    clickable: scope.kind !== "piece",
    status: "draft",
    x: at ? Math.min(Math.max(at.x, 0), 95) : 4,
    y: at ? Math.max(at.y, 0) : 4,
    width: 28,
    z: nextZ,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return id;
}

/** Saves the details dialog and publishes the piece. */
export async function savePortfolioItemDetails(
  id: string,
  details: { name: string; information: string; clickable: boolean },
): Promise<void> {
  await requireSession();
  const db = await getDb();

  const name = details.name.trim();
  await db
    .update(schema.portfolioItems)
    .set({
      name,
      slug: await uniqueSlug(name, id, id),
      information: details.information.trim(),
      clickable: details.clickable,
      status: "published",
      updatedAt: new Date(),
    })
    .where(eq(schema.portfolioItems.id, id));

  refresh();
}

/**
 * Clears a piece's images so a replacement can be uploaded.
 *
 * Removes the R2 objects as well; the rows alone would leave the bucket
 * accumulating everything the artist ever replaced.
 */
export async function clearPortfolioImages(id: string): Promise<void> {
  await requireSession();
  const db = await getDb();

  const images = await db
    .select({ storageKey: schema.portfolioImages.storageKey })
    .from(schema.portfolioImages)
    .where(eq(schema.portfolioImages.itemId, id));

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  await Promise.all(images.map((i) => env.MEDIA.delete(i.storageKey)));

  await db.delete(schema.portfolioImages).where(eq(schema.portfolioImages.itemId, id));
  refresh();
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
  layout: { x: number; y: number; width: number; z?: number },
): Promise<void> {
  await requireSession();
  const db = await getDb();

  await db
    .update(schema.portfolioItems)
    .set({
      // Clamped server-side too: a hand-crafted request must not be able to
      // give a piece a zero width or strand it far off the wall. Overlap and a
      // little bleed past the edges are allowed on purpose — the artist asked
      // to place work freely.
      x: Math.min(Math.max(layout.x, -25), 125),
      y: Math.max(layout.y, 0),
      width: Math.min(Math.max(layout.width, 5), 120),
      ...(layout.z === undefined ? {} : { z: Math.round(layout.z) }),
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
  // Children cascade at the row level, but their objects do not, so sweep the
  // whole family here.
  const family = await db
    .select({ id: schema.portfolioItems.id })
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.parentId, id));
  const ids = [id, ...family.map((f) => f.id)];

  const images = await db
    .select({ storageKey: schema.portfolioImages.storageKey })
    .from(schema.portfolioImages)
    .where(inArray(schema.portfolioImages.itemId, ids));

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  await Promise.all(images.map((i) => env.MEDIA.delete(i.storageKey)));

  await db.delete(schema.portfolioItems).where(eq(schema.portfolioItems.id, id));
  refresh();
  // No redirect: this is called from the wall, where cancelling a new image
  // must not navigate the artist away from what she was doing.
}

// ---------------------------------------------------------------- text boxes

/** Highest z across both pieces and text, so the two stack in one order. */
async function nextZ(): Promise<number> {
  const db = await getDb();
  const [pieces] = await db
    .select({ top: sql<number>`coalesce(max(${schema.portfolioItems.z}), 0)` })
    .from(schema.portfolioItems);
  const [texts] = await db
    .select({ top: sql<number>`coalesce(max(${schema.wallTexts.z}), 0)` })
    .from(schema.wallTexts);
  return Math.max(pieces.top, texts.top) + 1;
}

/** Placed where the artist opened the menu, not in a fixed corner. */
export async function createWallText(
  at?: { x: number; y: number },
  scope: WallScope = HOME_WALL,
): Promise<void> {
  await requireSession();
  const db = await getDb();

  const seed = docFromPlain("New text");
  await db.insert(schema.wallTexts).values({
    id: crypto.randomUUID(),
    content: docToPlain(seed),
    rich: serialiseDoc(seed),
    x: at ? Math.min(Math.max(at.x, 0), 95) : 4,
    y: at ? Math.max(at.y, 0) : 4,
    ...scopeColumns(scope),
    width: 40,
    height: 8,
    z: await nextZ(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  refresh();
}

export async function updateWallText(
  id: string,
  patch: {
    /** The rich document, as the editor produced it. */
    rich?: unknown;
    fontSize?: number;
    align?: "left" | "center" | "right";
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    colour?: string;
    font?: string;
  },
): Promise<void> {
  await requireSession();
  const db = await getDb();

  /*
    The registry now includes the artist's uploads, so the guard has to consult
    the database. Only when a font is actually being set: this same action
    carries bold, italic, size and colour from every toolbar click, and an
    unconditional read would put a query behind all of them.
  */
  const fontIsKnown =
    patch.font !== undefined && isKnownFontId(patch.font, mergeFonts(await getSiteFonts()));

  /*
    Sanitised here as well as in the browser, because a server action is a
    public endpoint: the editor's output is a suggestion, not a guarantee.
    `content` is written from the same document so the plain mirror can never
    drift from the marks it mirrors.
  */
  const doc =
    patch.rich === undefined
      ? undefined
      : sanitiseDoc(patch.rich, mergeFonts(await getSiteFonts()));

  const values = {
    ...(doc === undefined ? {} : { rich: serialiseDoc(doc), content: docToPlain(doc) }),
    // Guard rails so a stray value cannot make text invisible or fill the wall.
    ...(patch.fontSize === undefined
      ? {}
      : { fontSize: Math.min(Math.max(patch.fontSize, 0.5), 20) }),
    ...(patch.align === undefined ? {} : { align: patch.align }),
    ...(patch.bold === undefined ? {} : { bold: patch.bold }),
    ...(patch.italic === undefined ? {} : { italic: patch.italic }),
    ...(patch.underline === undefined ? {} : { underline: patch.underline }),
    // Only accept a real hex colour; anything else would break the style attribute.
    ...(patch.colour === undefined || !/^#[0-9a-f]{6}$/i.test(patch.colour)
      ? {}
      : { colour: patch.colour }),
    // Only a key the registry knows — an unknown one is dropped, never stored.
    ...(fontIsKnown && patch.font !== undefined ? { font: patch.font } : {}),
    updatedAt: new Date(),
  };

  await db.update(schema.wallTexts).set(values).where(eq(schema.wallTexts.id, id));
  refresh();
}

export async function saveWallTextLayout(
  id: string,
  layout: { x: number; y: number; width: number; height: number; z?: number },
): Promise<void> {
  await requireSession();
  const db = await getDb();

  await db
    .update(schema.wallTexts)
    .set({
      x: Math.min(Math.max(layout.x, -25), 125),
      y: Math.max(layout.y, 0),
      width: Math.min(Math.max(layout.width, 5), 120),
      height: Math.min(Math.max(layout.height, 2), 200),
      ...(layout.z === undefined ? {} : { z: Math.round(layout.z) }),
      updatedAt: new Date(),
    })
    .where(eq(schema.wallTexts.id, id));

  refresh();
}

export async function deleteWallText(id: string): Promise<void> {
  await requireSession();
  const db = await getDb();
  await db.delete(schema.wallTexts).where(eq(schema.wallTexts.id, id));
  refresh();
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
