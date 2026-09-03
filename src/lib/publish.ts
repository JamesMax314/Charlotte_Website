import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { asc, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { WIDTH_LADDER } from "@/image-loader";
import { getDb } from "./db";
import { hasValidSession } from "./auth";
import { derivativeKeys, usableKeys } from "./storage";
import {
  SNAPSHOT_LIMIT_BYTES,
  SNAPSHOT_VERSION,
  hashSnapshot,
  parseSnapshot,
  serialiseSnapshot,
  snapshotMediaKeys,
  timeless,
  type SiteSnapshot,
} from "./site-snapshot";

/**
 * Publishing: the seam between what the artist is working on and what a
 * visitor sees.
 *
 * The tables are the draft. A visitor is served the newest row in
 * `site_revisions`, which is a copy of everything the public site reads taken
 * at the moment she pressed "Make live". Every public query goes through
 * `getSiteSource` to decide which of the two it is reading.
 */

/** How many published versions to keep. Older ones are pruned on publish. */
const REVISIONS_KEPT = 10;

/**
 * Everything the public site could need, read out of the draft tables.
 *
 * Two filters and no more: draft artworks and draft portfolio items are
 * excluded because they resolve to nothing on any public surface, whatever
 * else is true of them. Everything else — archived artworks, draft custom
 * pages, wall text on a page nobody can reach — goes in and is filtered on the
 * way out by the same rules the D1 path applies.
 *
 * That asymmetry is deliberate. Over-including costs a few kilobytes in a row
 * that is never served raw; under-including silently removes content from the
 * live site, and the cases are subtle — a piece on a *draft* custom page still
 * answers at its own URL, so its page's elements are reachable even though the
 * wall it sits on is not.
 */
export const buildDraftSnapshot = async (): Promise<SiteSnapshot> => {
  const db = await getDb();

  /*
    Every list is ordered down to `id`. The order is part of what gets hashed,
    so a query whose sort has ties would produce a different digest each time
    D1 felt like returning them the other way round — and the artist would be
    told her site had unpublished changes at random.
  */
  const [settingsRows, fonts, pages, items, texts, artworks] = await Promise.all([
    db.select().from(schema.siteSettings).where(eq(schema.siteSettings.id, 1)).limit(1),
    db
      .select()
      .from(schema.siteFonts)
      .orderBy(asc(schema.siteFonts.createdAt), asc(schema.siteFonts.id)),
    db
      .select()
      .from(schema.sitePages)
      .orderBy(asc(schema.sitePages.navOrder), asc(schema.sitePages.id)),
    db
      .select()
      .from(schema.portfolioItems)
      .where(eq(schema.portfolioItems.status, "published"))
      .orderBy(asc(schema.portfolioItems.z), asc(schema.portfolioItems.id)),
    db.select().from(schema.wallTexts).orderBy(asc(schema.wallTexts.z), asc(schema.wallTexts.id)),
    db
      .select()
      .from(schema.artworks)
      .where(ne(schema.artworks.status, "draft"))
      .orderBy(asc(schema.artworks.sortOrder), asc(schema.artworks.id)),
  ]);

  const itemIds = items.map((row) => row.id);
  const artworkIds = artworks.map((row) => row.id);

  // `inArray` on an empty list is not worth relying on; skip the query instead.
  const [itemImages, artworkImages, listings] = await Promise.all([
    itemIds.length === 0
      ? []
      : db
          .select()
          .from(schema.portfolioImages)
          .where(inArray(schema.portfolioImages.itemId, itemIds))
          .orderBy(
            asc(schema.portfolioImages.itemId),
            asc(schema.portfolioImages.sortOrder),
            asc(schema.portfolioImages.id),
          ),
    artworkIds.length === 0
      ? []
      : db
          .select()
          .from(schema.artworkImages)
          .where(inArray(schema.artworkImages.artworkId, artworkIds))
          .orderBy(
            asc(schema.artworkImages.artworkId),
            asc(schema.artworkImages.sortOrder),
            asc(schema.artworkImages.id),
          ),
    artworkIds.length === 0
      ? []
      : db
          .select()
          .from(schema.listings)
          .where(inArray(schema.listings.artworkId, artworkIds))
          .orderBy(
            asc(schema.listings.artworkId),
            asc(schema.listings.sortOrder),
            asc(schema.listings.id),
          ),
  ]);

  return {
    version: SNAPSHOT_VERSION,
    settings: settingsRows.length === 0 ? null : timeless(settingsRows)[0],
    fonts: timeless(fonts),
    pages: timeless(pages),
    items: timeless(items),
    itemImages,
    texts: timeless(texts),
    artworks: timeless(artworks),
    artworkImages,
    listings,
  };
};

type PublishedRevision = { id: number; hash: string; publishedAt: Date; snapshot: SiteSnapshot };

/**
 * The live site.
 *
 * Guarded like `getSiteSettings`, and for the same reason: this is now on the
 * critical path of every public page, so a missing migration or an unreachable
 * D1 must degrade to the draft tables rather than take the site down. Null
 * means "nothing published yet", which is also what a site reads as before the
 * artist has pressed the button for the first time.
 *
 * Memoised per request — the layout, the header and the page each ask.
 */
export const getPublishedRevision = cache(async (): Promise<PublishedRevision | null> => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.siteRevisions)
      .orderBy(desc(schema.siteRevisions.id))
      .limit(1);
    if (rows.length === 0) return null;

    const snapshot = parseSnapshot(rows[0].snapshot);
    if (snapshot === null) return null;
    return {
      id: rows[0].id,
      hash: rows[0].hash,
      publishedAt: rows[0].publishedAt,
      snapshot,
    };
  } catch (cause) {
    // Never swallow Next's own control-flow errors — see the invariant.
    unstable_rethrow(cause);
    console.error("[publish] could not read the published site; serving the draft", cause);
    return null;
  }
});

export type SiteSource =
  | { kind: "live"; snapshot: SiteSnapshot }
  /** `session` means an admin is previewing; `unpublished` means nothing is live yet. */
  | { kind: "draft"; reason: "session" | "unpublished" };

/**
 * Which of the two every public read should use.
 *
 * A signed-in artist gets the draft on the real site, so "View site" shows her
 * what she is about to publish rather than what is already out there. Settings
 * and the static pages have no other preview — the wall editor covers the
 * walls, and nothing covers the header height or the About copy.
 *
 * The cookie is only read when one is present, so a visitor pays nothing for
 * this. Memoised so the session is verified once per request rather than once
 * per query.
 */
export const getSiteSource = cache(async (): Promise<SiteSource> => {
  if (await hasValidSession()) return { kind: "draft", reason: "session" };
  const published = await getPublishedRevision();
  return published === null
    ? { kind: "draft", reason: "unpublished" }
    : { kind: "live", snapshot: published.snapshot };
});

export type PublishState = {
  /** True when the draft and the live site are identical. */
  live: boolean;
  publishedAt: Date | null;
};

/**
 * The published revision's identity, without its contents.
 *
 * `getPublishedRevision` selects the whole row, so reading it to answer "is
 * the draft live?" pulls the entire public site out of D1 and `JSON.parse`s
 * it — a megabyte of work to compare two hex strings. Everything that only
 * needs to *identify* the live site reads this instead; only a caller that
 * has to serve the live site's content pays for the snapshot.
 *
 * Not memoised, because its two callers each ask once and one of them wants a
 * value that a write earlier in the same request may have changed.
 */
const getPublishedMeta = async (): Promise<{ hash: string; publishedAt: Date } | null> => {
  try {
    const db = await getDb();
    const rows = await db
      .select({ hash: schema.siteRevisions.hash, publishedAt: schema.siteRevisions.publishedAt })
      .from(schema.siteRevisions)
      .orderBy(desc(schema.siteRevisions.id))
      .limit(1);
    return rows.length === 0 ? null : rows[0];
  } catch (cause) {
    // Never swallow Next's own control-flow errors — see the invariant.
    unstable_rethrow(cause);
    console.error("[publish] could not read the published revision's hash", cause);
    return null;
  }
};

/**
 * What the studio's badge reports.
 *
 * Compares a hash of the draft against the hash stored with the published
 * revision, rather than tracking a dirty flag. A flag has to be set by every
 * write, across four action modules and two route handlers, and the failure
 * when one forgets is a button that tells the artist her site is live when it
 * is not. A hash cannot drift out of step with the content, because it is the
 * content.
 *
 * Expensive, and deliberately so — it reads every content table to hash what
 * they hold. That is why nothing renders it synchronously any more: it is
 * behind `/api/admin/publish-state`, which the badge asks for once, rather
 * than in the admin layout, where it ran on every render and therefore on
 * every keystroke. See the invariant in docs/progress.md.
 *
 * The published side is read hash-only, and the draft is not built at all when
 * there is nothing to compare it against — which is every request on a site
 * that has never been published, local development included.
 */
export const getPublishState = async (): Promise<PublishState> => {
  const published = await getPublishedMeta();
  if (published === null) return { live: false, publishedAt: null };
  return {
    live: published.hash === (await hashSnapshot(await buildDraftSnapshot())),
    publishedAt: published.publishedAt,
  };
};

/**
 * Copies the draft over the live site.
 *
 * One row, one write: a set of edits the artist made over an afternoon reaches
 * visitors together or not at all. Republishing an unchanged site is a no-op
 * rather than a duplicate revision.
 */
export const publishSite = async (): Promise<PublishState> => {
  const db = await getDb();
  /*
    Hash-only on the published side. Publishing does read a full snapshot, but
    it is the *draft* one — `sweepPendingDeletions` asks what the new live site
    still needs, never what the old one did — so parsing the outgoing revision
    was a megabyte of work whose only use was one string comparison.
  */
  const [published, draft] = await Promise.all([getPublishedMeta(), buildDraftSnapshot()]);
  const hash = await hashSnapshot(draft);

  if (published !== null && published.hash === hash) {
    return { live: true, publishedAt: published.publishedAt };
  }

  const serialised = serialiseSnapshot(draft);
  const size = new TextEncoder().encode(serialised).length;
  if (size > SNAPSHOT_LIMIT_BYTES) {
    throw new Error(
      `The site is too large to publish: ${Math.round(size / 1024)}KB against a limit of ` +
        `${Math.round(SNAPSHOT_LIMIT_BYTES / 1024)}KB. Removing some work will bring it back ` +
        `under.`,
    );
  }

  const publishedAt = new Date();
  await db.insert(schema.siteRevisions).values({ hash, snapshot: serialised, publishedAt });

  await Promise.all([sweepPendingDeletions(draft), pruneRevisions()]);
  return { live: true, publishedAt };
};

/** Keeps the newest few revisions; each one can be most of a megabyte. */
const pruneRevisions = async (): Promise<void> => {
  const db = await getDb();
  const keep = await db
    .select({ id: schema.siteRevisions.id })
    .from(schema.siteRevisions)
    .orderBy(desc(schema.siteRevisions.id))
    .limit(REVISIONS_KEPT);
  if (keep.length < REVISIONS_KEPT) return;
  await db.delete(schema.siteRevisions).where(
    notInArray(
      schema.siteRevisions.id,
      keep.map((row) => row.id),
    ),
  );
};

/**
 * Removes R2 objects that a delete deferred and the new live site no longer
 * wants.
 *
 * A key that is still referenced stays pending: the same bytes can be shared
 * by two pieces, because keys are content-addressed, so "the artist deleted
 * the piece that uploaded it" does not mean the object is unused.
 */
const sweepPendingDeletions = async (published: SiteSnapshot): Promise<void> => {
  const db = await getDb();
  const pending = await db.select().from(schema.pendingMediaDeletions);
  if (pending.length === 0) return;

  const stillUsed = snapshotMediaKeys(published);
  const removable = pending.map((row) => row.storageKey).filter((key) => !stillUsed.has(key));
  if (removable.length === 0) return;

  const { env } = await getCloudflareContext({ async: true });
  await env.MEDIA.delete(removable.flatMap((key) => [key, ...derivativeKeys(key, WIDTH_LADDER)]));
  await db
    .delete(schema.pendingMediaDeletions)
    .where(inArray(schema.pendingMediaDeletions.storageKey, removable));
};

/**
 * Gives up an R2 object. Queues it; never deletes it here.
 *
 * Every delete path goes through here. Deleting immediately was correct while
 * the studio and the site were the same thing; then the published revision
 * arrived, and a piece the artist removed from her draft was still on the live
 * site until she pressed the button — so keys the live site referenced were
 * queued and everything else went straight out of the bucket.
 *
 * That remaining immediate delete is now wrong too, and for a second reason:
 * every delete in the studio is undoable. An object destroyed on the way out
 * cannot come back, so an undo would restore the row and leave a piece on the
 * wall with a broken image — the failure being total, silent, and visible only
 * once she looked. There is no useful test for "she might press Cmd+Z", so the
 * distinction goes and everything is queued.
 *
 * Nothing leaks by doing so. `sweepPendingDeletions` runs on every publish and
 * removes exactly the queued keys the new revision does not reference, which
 * is the same answer this function used to compute — taken later, once undo
 * can no longer change it. The cost is that a bucket holds deleted objects
 * until the next "Make live", which is the moment the artist decides what the
 * site contains anyway.
 *
 * The sweep also removes the width-ladder derivatives, which the portfolio and
 * artwork deletes never did — the base object went and `-400` and `-800`
 * stayed in the bucket forever.
 */
export const releaseMedia = async (keys: (string | null | undefined)[]): Promise<void> => {
  const wanted = usableKeys(keys);
  if (wanted.length === 0) return;

  const db = await getDb();
  await db
    .insert(schema.pendingMediaDeletions)
    .values(wanted.map((storageKey) => ({ storageKey })))
    .onConflictDoNothing();
};

/**
 * Takes keys back out of the deletion queue, because something is using them
 * again.
 *
 * Keys are content-addressed, so deleting a piece and then re-uploading the
 * same file produces the same key. Without this the key sits in the queue
 * permanently: `releaseMedia` put it there while the published site still
 * needed it, and the sweep then refuses to remove it precisely *because* the
 * new revision references it again. Nothing is ever wrongly deleted — the
 * queue simply never drains, and a stale row reads as an asset that cannot be
 * deleted.
 *
 * Called wherever an object is written, which is the only moment a key can
 * come back into use.
 */
export const claimMedia = async (keys: (string | null | undefined)[]): Promise<void> => {
  const wanted = usableKeys(keys);
  if (wanted.length === 0) return;

  const db = await getDb();
  await db
    .delete(schema.pendingMediaDeletions)
    .where(inArray(schema.pendingMediaDeletions.storageKey, wanted));
};
