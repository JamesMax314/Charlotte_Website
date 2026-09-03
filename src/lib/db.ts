import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * The D1 handle, on its own so nothing has to import a query module to get it.
 *
 * It used to live in `catalogue.ts`, which was fine until the publish layer
 * needed it: `catalogue` reads through `getSiteSource`, `getSiteSource` lives
 * in `publish`, and `publish` needs the database — a cycle that only resolved
 * by accident of ESM evaluation order. A leaf module breaks it outright.
 */

/**
 * One Drizzle instance per binding, for the life of the isolate.
 *
 * `drizzle(db, { schema })` is not a cheap wrapper: it walks every export of
 * the schema module and builds the relational config each time it is called.
 * A single admin render calls `getDb` fifteen or more times — the layout, the
 * page, the publish snapshot's nine queries — and was paying for that graph
 * every one of them, on a platform that allows ten milliseconds of CPU.
 *
 * Keyed on the binding rather than on the env object, because OpenNext may
 * hand out a fresh `env` per request while the binding behind it is the same
 * object for the isolate's whole life. Sharing is safe: the handle holds a
 * query builder and the binding, and no per-request state — the same reason
 * a module-level registry would *not* be safe (see `getWallTexts`).
 */
const handles = new WeakMap<D1Database, DrizzleD1Database<typeof schema>>();

export const getDb = async () => {
  const { env } = await getCloudflareContext({ async: true });
  const existing = handles.get(env.DB);
  if (existing !== undefined) return existing;

  const handle = drizzle(env.DB, { schema });
  handles.set(env.DB, handle);
  return handle;
};
