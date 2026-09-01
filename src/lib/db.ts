import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * The D1 handle, on its own so nothing has to import a query module to get it.
 *
 * It used to live in `catalogue.ts`, which was fine until the publish layer
 * needed it: `catalogue` reads through `getSiteSource`, `getSiteSource` lives
 * in `publish`, and `publish` needs the database — a cycle that only resolved
 * by accident of ESM evaluation order. A leaf module breaks it outright.
 */
export const getDb = async () => {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
};
