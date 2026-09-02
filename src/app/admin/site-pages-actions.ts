"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { releaseMedia } from "@/lib/publish";
import { deletePiecesWithPages } from "@/lib/portfolio-deletes";
import { toSlug } from "@/lib/artworks";
import { requireSession } from "@/lib/auth";
import { isReservedPageSlug, UNTITLED_PAGE_TITLE } from "@/lib/site-pages";

/**
 * The artist's custom pages — the links in the middle of the top bar.
 *
 * As everywhere in the admin, each entry point gates itself: server actions
 * are routed independently of layouts, so the admin layout protects pages only.
 */

// The header renders on every route, so a change to the nav has to invalidate
// the whole layout rather than one path.
const refresh = () => revalidatePath("/", "layout");

/**
 * A slug free for a page to take.
 *
 * A reserved name is treated as a clash rather than an error: Next resolves
 * `/about` to the static route whatever the database says, so accepting the
 * name would hand the artist a page she can edit and never visit. She sees the
 * adjusted slug in the editor field the moment it saves.
 */
async function uniquePageSlug(base: string, excludeId?: string): Promise<string> {
  const db = await getDb();
  const root = toSlug(base) || "page";

  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    if (isReservedPageSlug(candidate)) continue;

    const clash = await db
      .select({ id: schema.sitePages.id })
      .from(schema.sitePages)
      .where(eq(schema.sitePages.slug, candidate))
      .limit(1);
    if (clash.length === 0 || clash[0].id === excludeId) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Adds a page and returns its id so the studio can open its editor.
 *
 * Created as a draft: it appears in the studio's top bar straight away, but
 * nothing reaches the public nav until the artist has put something on it and
 * published it.
 */
export async function createSitePage(): Promise<string> {
  await requireSession();
  const db = await getDb();

  const id = crypto.randomUUID();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.sitePages.navOrder}), 0) + 1` })
    .from(schema.sitePages);

  await db.insert(schema.sitePages).values({
    id,
    slug: await uniquePageSlug(UNTITLED_PAGE_TITLE),
    title: UNTITLED_PAGE_TITLE,
    status: "draft",
    navOrder: next,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  refresh();
  return id;
}

export async function updateSitePage(
  id: string,
  patch: { title?: string; slug?: string; status?: "draft" | "published" },
): Promise<void> {
  await requireSession();
  const db = await getDb();

  const title = patch.title?.trim();
  // A blank slug field means "follow the title" — the same courtesy the store
  // and the portfolio extend, so renaming a page fixes its URL.
  const slugSource = patch.slug?.trim() || title;

  await db
    .update(schema.sitePages)
    .set({
      ...(title === undefined ? {} : { title }),
      ...(slugSource === undefined ? {} : { slug: await uniquePageSlug(slugSource, id) }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      updatedAt: new Date(),
    })
    .where(eq(schema.sitePages.id, id));

  refresh();
}

/**
 * The left-to-right order of the links, set by dragging them.
 *
 * One CASE statement rather than a write per row, as the store's reorder does:
 * the whole nav lands atomically, so a dropped connection cannot leave the top
 * bar half-rearranged.
 */
export async function reorderSitePages(ids: string[]): Promise<void> {
  await requireSession();
  if (ids.length === 0) return;

  const db = await getDb();
  const cases = ids.map((id, index) => sql`when ${id} then ${index + 1}`);

  await db
    .update(schema.sitePages)
    .set({
      navOrder: sql`case ${schema.sitePages.id} ${sql.join(cases, sql` `)} end`,
      updatedAt: new Date(),
    })
    .where(inArray(schema.sitePages.id, ids));

  refresh();
}

/**
 * Deletes a page and everything arranged on it.
 *
 * Content on the page cascades by `page_id`, which the database really does
 * carry. What it does not carry is `parent_id`, so a piece's own sub-page has
 * to be deleted here — and before the page is, or the cascade tries to remove
 * a piece that still has elements hanging off it and the whole delete fails.
 *
 * R2 objects cascade nowhere, so the family's images are swept first. Missing
 * that leaves the bucket holding artwork nothing can ever reference again.
 */
export async function deleteSitePage(id: string): Promise<void> {
  await requireSession();
  const db = await getDb();

  const onPage = await db
    .select({ id: schema.portfolioItems.id })
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.pageId, id));

  const children =
    onPage.length === 0
      ? []
      : await db
          .select({ id: schema.portfolioItems.id })
          .from(schema.portfolioItems)
          .where(
            inArray(
              schema.portfolioItems.parentId,
              onPage.map((item) => item.id),
            ),
          );

  const ids = [...onPage, ...children].map((item) => item.id);

  if (ids.length > 0) {
    const images = await db
      .select({ storageKey: schema.portfolioImages.storageKey })
      .from(schema.portfolioImages)
      .where(inArray(schema.portfolioImages.itemId, ids));

    await releaseMedia(images.map((i) => i.storageKey));
  }

  await deletePiecesWithPages(onPage.map((item) => item.id));
  await db.delete(schema.sitePages).where(eq(schema.sitePages.id, id));
  refresh();
}
