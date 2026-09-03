"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { releaseMedia } from "@/lib/publish";
import { deletePiecesWithPages } from "@/lib/portfolio-deletes";
import { mergeBackups, type Backup } from "@/lib/undo-backup";
import { capturePieces, capturePortfolioImages, captureWallTexts } from "@/lib/undo-restore";
import { toSlug, isPlaceholderSlug } from "@/lib/artworks";
import { isKnownFontId, mergeFonts } from "@/lib/fonts";
import { resolveGridColumns } from "@/lib/grid";
import { docFromPlain, docToPlain, sanitiseDoc, serialiseDoc } from "@/lib/rich-text";
import { requireSession } from "@/lib/auth";
import {
  clampTo,
  HOME_WALL,
  WALL_LIMITS,
  WALL_TEXT_CQW,
  scopeColumns,
  type WallScope,
} from "@/lib/portfolio";
import { getSiteFonts, upsertSiteSettings } from "@/lib/site-settings";

/**
 * Portfolio mutations — the home page wall.
 *
 * As in artwork actions, every entry point gates itself: server actions are
 * routed independently of layouts, so the admin layout protects pages only.
 */

const refresh = () => revalidatePath("/", "layout");

/*
  Not every write calls it, and which ones do is a decision worth stating once.

  `revalidatePath` is the only switch that decides whether Next re-renders the
  whole route tree into an action's response: `skipPageRendering` in Next's
  action handler is set from nothing else. So on an autosave — a write that
  only sends back values the canvas has *already* applied optimistically —
  calling it buys a full round trip through the root layout, the admin layout
  and the wall to be told what the browser is already showing. That happened on
  every keystroke and on every drag.

  Nothing goes stale without it. There is no route cache to invalidate, because
  every page is `force-dynamic`; and no client router cache either, because
  Next's `staleTimes.dynamic` defaults to 0, so a navigation to the public site
  always refetches. The re-render was the whole effect — and the canvas does
  not want it, since fresh props reset its local state, which mid-sentence
  means the server's re-sanitised document pushed back into the box the artist
  is still typing in.

  A write that creates or removes a row is different and still calls
  `refresh()`: the canvas cannot invent an id, so it needs the render. The
  autosaves below are marked where they end.
*/

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
  gridEnabled?: boolean;
  gridColumns?: number;
  gridSnap?: boolean;
  showNamesOnHover?: boolean;
  contentFadeIn?: boolean;
}): Promise<void> {
  await requireSession();

  const values = {
    ...(patch.gutterEnabled === undefined ? {} : { gutterEnabled: patch.gutterEnabled }),
    // A gutter wider than a fifth of the wall is not a gutter any more.
    ...(patch.gutter === undefined ? {} : { gutter: Math.min(Math.max(patch.gutter, 0), 20) }),
    ...(patch.snapEnabled === undefined ? {} : { snapEnabled: patch.snapEnabled }),
    ...(patch.gridEnabled === undefined ? {} : { gridEnabled: patch.gridEnabled }),
    // A column count off the list is no grid at all — the quarter lines would
    // fall between the lines they are meant to emphasise.
    ...(patch.gridColumns === undefined
      ? {}
      : { gridColumns: resolveGridColumns(patch.gridColumns) }),
    ...(patch.gridSnap === undefined ? {} : { gridSnap: patch.gridSnap }),
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
    // Written rather than left to the column default, so the row this returns
    // matches what the dialog is about to show the artist.
    zoomable: true,
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
  details: { name: string; information: string; clickable: boolean; zoomable: boolean },
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
      zoomable: details.zoomable,
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
export async function clearPortfolioImages(id: string): Promise<Backup> {
  await requireSession();
  const db = await getDb();

  const images = await db
    .select()
    .from(schema.portfolioImages)
    .where(eq(schema.portfolioImages.itemId, id));

  await releaseMedia(images.map((i) => i.storageKey));

  await db.delete(schema.portfolioImages).where(eq(schema.portfolioImages.itemId, id));
  refresh();
  return { portfolio_images: images as unknown as Record<string, unknown>[] };
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
      x: clampTo(layout.x, WALL_LIMITS.x),
      y: Math.max(layout.y, 0),
      width: clampTo(layout.width, WALL_LIMITS.width),
      ...(layout.z === undefined ? {} : { z: Math.round(layout.z) }),
      updatedAt: new Date(),
    })
    .where(eq(schema.portfolioItems.id, id));

  // Autosave: no revalidation, and no re-render. See the note by `refresh`.
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

export async function deletePortfolioItem(id: string): Promise<Backup> {
  await requireSession();
  const db = await getDb();

  // Read before removing, so undo has the rows to put back. Inside the delete
  // rather than as a call of its own: a separate capture is a second round
  // trip with a gap in the middle where the two answers can disagree.
  const backup = await capturePieces([id]);

  // Remove the R2 objects too, or the bucket accumulates orphans forever.
  // Neither the rows nor the objects cascade, so the whole family is collected
  // here: swept from the bucket below, and deleted by `deletePiecesWithPages`.
  const family = await db
    .select({ id: schema.portfolioItems.id })
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.parentId, id));
  const ids = [id, ...family.map((f) => f.id)];

  const images = await db
    .select({ storageKey: schema.portfolioImages.storageKey })
    .from(schema.portfolioImages)
    .where(inArray(schema.portfolioImages.itemId, ids));

  await releaseMedia(images.map((i) => i.storageKey));

  await deletePiecesWithPages([id]);
  refresh();
  // No redirect: this is called from the wall, where cancelling a new image
  // must not navigate the artist away from what she was doing.
  return backup;
}

/**
 * Puts pieces away without deleting them.
 *
 * Unlike delete, nothing here touches R2 or the piece's own page: the row
 * keeps its images and — because a page's elements point at it by
 * `parent_id`, untouched — whatever the artist arranged there, so a restore
 * gets back the whole piece rather than a picture to rebuild. Only the piece's
 * own scope pair is cleared, back to the pair the home wall uses, which is
 * what makes the archive one box shared by every wall rather than one per
 * page. A `parent_id` is never in `ids` here — the option is not offered for
 * an element on a piece's own page, and archiving one would orphan whatever
 * the artist arranged on top of it.
 *
 * One statement for the whole selection, exactly like `deleteWallSelection`:
 * a group action is one related change, not `ids.length` of them.
 */
export async function archivePortfolioItems(ids: string[]): Promise<void> {
  await requireSession();
  if (ids.length === 0) return;
  const db = await getDb();

  await db
    .update(schema.portfolioItems)
    .set({ status: "archived", parentId: null, pageId: null, updatedAt: new Date() })
    .where(inArray(schema.portfolioItems.id, ids));

  refresh();
}

/**
 * Brings an archived piece back, at the point the artist right-clicked.
 *
 * Restores to whichever wall the menu was opened on — the archive is shared,
 * so this is what lets a piece put away from the home page return onto a
 * custom one. Brought to the front, exactly as a freshly added piece is: an
 * old arrangement's z would otherwise bury it under everything added since.
 */
export async function restorePortfolioItem(
  id: string,
  at: { x: number; y: number },
  scope: WallScope = HOME_WALL,
): Promise<void> {
  await requireSession();
  const db = await getDb();

  const [{ nextZ }] = await db
    .select({ nextZ: sql<number>`coalesce(max(${schema.portfolioItems.z}), 0) + 1` })
    .from(schema.portfolioItems);

  await db
    .update(schema.portfolioItems)
    .set({
      status: "published",
      ...scopeColumns(scope),
      x: Math.min(Math.max(at.x, 0), 95),
      y: Math.max(at.y, 0),
      z: nextZ,
      updatedAt: new Date(),
    })
    .where(eq(schema.portfolioItems.id, id));

  refresh();
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
      : { fontSize: Math.min(Math.max(patch.fontSize, WALL_TEXT_CQW.min), WALL_TEXT_CQW.max) }),
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
  // Autosave: no revalidation, and no re-render. See the note by `refresh`.
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
      x: clampTo(layout.x, WALL_LIMITS.x),
      y: Math.max(layout.y, 0),
      width: clampTo(layout.width, WALL_LIMITS.width),
      height: clampTo(layout.height, WALL_LIMITS.height),
      ...(layout.z === undefined ? {} : { z: Math.round(layout.z) }),
      updatedAt: new Date(),
    })
    .where(eq(schema.wallTexts.id, id));

  // Autosave: no revalidation, and no re-render. See the note by `refresh`.
}

export async function deleteWallText(id: string): Promise<Backup> {
  await requireSession();
  const db = await getDb();
  const backup = await captureWallTexts([id]);
  await db.delete(schema.wallTexts).where(eq(schema.wallTexts.id, id));
  refresh();
  return backup;
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

export async function deletePortfolioImage(id: string): Promise<Backup> {
  await requireSession();
  const db = await getDb();

  const backup = await capturePortfolioImages([id]);

  await releaseMedia((backup.portfolio_images ?? []).map((row) => row.storageKey as string));

  await db.delete(schema.portfolioImages).where(eq(schema.portfolioImages.id, id));
  refresh();
  return backup;
}

// ---------------------------------------------------------------- selections

/**
 * Persists a group move, scale, align or distribute.
 *
 * One D1 round trip for the whole selection, for the reason the reorder
 * `CASE` statement exists: a group is a set of related changes, and a dropped
 * connection halfway through a write-per-element would leave the arrangement
 * half moved — worse than not having moved at all, because the artist cannot
 * see which half. `db.batch` runs the statements in a single transaction.
 *
 * Every field is clamped exactly as the single-element actions clamp it. This
 * is a public endpoint like any other server action, and the browser's maths
 * is a suggestion.
 */
export async function saveWallLayouts(layout: {
  items: { id: string; x: number; y: number; width: number }[];
  texts: { id: string; x: number; y: number; width: number; height: number; fontSize: number }[];
}): Promise<void> {
  await requireSession();
  const db = await getDb();
  const now = new Date();

  const statements: BatchItem<"sqlite">[] = [
    ...layout.items.map((item) =>
      db
        .update(schema.portfolioItems)
        .set({
          x: clampTo(item.x, WALL_LIMITS.x),
          y: Math.max(item.y, 0),
          width: clampTo(item.width, WALL_LIMITS.width),
          updatedAt: now,
        })
        .where(eq(schema.portfolioItems.id, item.id)),
    ),
    ...layout.texts.map((text) =>
      db
        .update(schema.wallTexts)
        .set({
          x: clampTo(text.x, WALL_LIMITS.x),
          y: Math.max(text.y, 0),
          width: clampTo(text.width, WALL_LIMITS.width),
          height: clampTo(text.height, WALL_LIMITS.height),
          // A group scale carries the type with the box, so this arrives on a
          // layout save rather than only from the formatting panel.
          fontSize: clampTo(text.fontSize, WALL_TEXT_CQW),
          updatedAt: now,
        })
        .where(eq(schema.wallTexts.id, text.id)),
    ),
  ];

  if (statements.length === 0) return;

  // `batch` is typed as a non-empty tuple; the guard above is what makes this
  // true, and there is no way to express that to TypeScript.
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  // Autosave: no revalidation, and no re-render. See the note by `refresh`.
}

/**
 * Deletes everything in a selection.
 *
 * The R2 sweep is the whole reason this cannot be a loop over
 * `deletePortfolioItem`: each piece may own a page of its own whose elements
 * carry objects. One `inArray` collects the whole family across every selected
 * piece, in one round trip rather than one per piece.
 */
export async function deleteWallSelection(selection: {
  items: string[];
  texts: string[];
}): Promise<Backup> {
  await requireSession();
  const db = await getDb();

  // Both halves captured up front, before either is removed — a group delete
  // is one action to the artist and must be one entry to undo.
  const backup = mergeBackups(
    await capturePieces(selection.items),
    await captureWallTexts(selection.texts),
  );

  if (selection.items.length > 0) {
    const family = await db
      .select({ id: schema.portfolioItems.id })
      .from(schema.portfolioItems)
      .where(inArray(schema.portfolioItems.parentId, selection.items));
    const ids = [...selection.items, ...family.map((f) => f.id)];

    const images = await db
      .select({ storageKey: schema.portfolioImages.storageKey })
      .from(schema.portfolioImages)
      .where(inArray(schema.portfolioImages.itemId, ids));

    await releaseMedia(images.map((i) => i.storageKey));
    await deletePiecesWithPages(selection.items);
  }

  if (selection.texts.length > 0) {
    await db.delete(schema.wallTexts).where(inArray(schema.wallTexts.id, selection.texts));
  }

  refresh();
  return backup;
}
