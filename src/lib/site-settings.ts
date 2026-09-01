import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb } from "./db";
import { getSiteSource } from "./publish";
import type { UploadedFont } from "./fonts";

/**
 * Writes to the single settings row, creating it if it does not exist.
 *
 * Lives here rather than beside the actions because two "use server" modules
 * need it, and every export of one of those has to be an async server action.
 */
export const upsertSiteSettings = async (
  values: Partial<typeof schema.siteSettings.$inferInsert>,
): Promise<void> => {
  if (Object.keys(values).length === 0) return;

  const db = await getDb();
  const existing = await db
    .select({ id: schema.siteSettings.id })
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.id, 1));

  if (existing.length === 0) {
    await db.insert(schema.siteSettings).values({ id: 1, ...values });
  } else {
    await db.update(schema.siteSettings).set(values).where(eq(schema.siteSettings.id, 1));
  }
};

/**
 * The fonts the artist has uploaded.
 *
 * Memoised for the same reason as `getSiteSettings`: the root layout emits the
 * @font-face rules, and the wall and the admin canvas each need the list to
 * resolve a stored key.
 *
 * Degrades to an empty list rather than throwing, so a missing table cannot
 * take down every page — text boxes using an uploaded font simply fall back to
 * Inter, which is the same path a deleted font takes.
 */
export const getSiteFonts = cache(async (): Promise<UploadedFont[]> => {
  try {
    const source = await getSiteSource();
    const rows =
      source.kind === "live"
        ? source.snapshot.fonts
        : await (
            await getDb()
          )
            .select()
            .from(schema.siteFonts)
            .orderBy(asc(schema.siteFonts.createdAt));
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      family: row.family,
      storageKey: row.storageKey,
      format: row.format,
    }));
  } catch (cause) {
    // Never swallow Next's own control-flow errors — see the invariant.
    unstable_rethrow(cause);
    console.error("[settings] could not read uploaded fonts", cause);
    return [];
  }
});
