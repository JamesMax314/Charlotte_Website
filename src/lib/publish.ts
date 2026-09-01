import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { asc, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { WIDTH_LADDER } from "@/image-loader";
import { getDb } from "./db";
import { hasValidSession } from "./auth";
import { derivativeKeys, isSafeKey } from "./storage";
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
 * What the studio's badge reports.
 *
 * Compares a hash of the draft against the hash stored with the published
 * revision, rather than tracking a dirty flag. A flag has to be set by every
 * write, across four action modules and two route handlers, and the failure
 * when one forgets is a button that tells the artist her site is live when it
 * is not. A hash cannot drift out of step with the content, because it is the
 * content.
 */
export const getPublishState = async (): Promise<PublishState> => {
  const [published, draft] = await Promise.all([getPublishedRevision(), buildDraftSnapshot()]);
  if (published === null) return { live: false, publishedAt: null };
  return {
    live: published.hash === (await hashSnapshot(draft)),
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
  const [published, draft] = await Promise.all([getPublishedRevision(), buildDraftSnapshot()]);
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
 * Gives up an R2 object, deleting it only if the live site does not need it.
 *
 * Every delete path goes through here. Deleting immediately was correct while
 * the studio and the site were the same thing; now a piece the artist removes
 * from her draft is still on the published site until she presses the button,
 * and pulling its images out from underneath it would knock holes in pages she
 * had not touched.
 *
 * Also removes the width-ladder derivatives, which the portfolio and artwork
 * deletes never did — the base object went and `-400` and `-800` stayed in the
 * bucket forever.
 */
export const releaseMedia = async (keys: (string | null | undefined)[]): Promise<void> => {
  const wanted = [...new Set(keys.filter((key): key is string => !!key && isSafeKey(key)))];
  if (wanted.length === 0) return;

  const published = await getPublishedRevision();
  const stillLive = published === null ? new Set<string>() : snapshotMediaKeys(published.snapshot);

  const deferred = wanted.filter((key) => stillLive.has(key));
  const removable = wanted.filter((key) => !stillLive.has(key));

  const { env } = await getCloudflareContext({ async: true });
  if (removable.length > 0) {
    await env.MEDIA.delete(removable.flatMap((key) => [key, ...derivativeKeys(key, WIDTH_LADDER)]));
  }
  if (deferred.length > 0) {
    const db = await getDb();
    await db
      .insert(schema.pendingMediaDeletions)
      .values(deferred.map((storageKey) => ({ storageKey })))
      .onConflictDoNothing();
  }
};
