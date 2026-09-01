import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_HOST, SITE_URL } from "@/lib/site";

// Reads the request host, so it cannot be prerendered.
export const dynamic = "force-dynamic";

/**
 * Indexing is allowed on the canonical host and refused everywhere else.
 *
 * A Worker answers on its `*.workers.dev` subdomain as well as on any custom
 * domain, so the same site is reachable at two origins. Both serve canonicals
 * pointing at `SITE_URL`, which is right, but a crawler that finds the
 * workers.dev copy first can still index it — and until DNS is cut over that
 * copy's canonical names a domain that does not resolve at all. For a site
 * whose stated goal is ranking for the artist's own name, that is the one
 * mistake worth engineering against.
 *
 * Derived from the request rather than a flag, so there is nothing to remember
 * to switch off when the domain goes live, and nothing to switch back on if a
 * second origin ever appears.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");

  return {
    rules: host === SITE_HOST ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
