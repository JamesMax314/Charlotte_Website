import type { MetadataRoute } from "next";
import { getRoutableSlugs } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getRoutableSlugs();

  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/about`, priority: 0.5 },
    { url: `${SITE_URL}/contact`, priority: 0.5 },
    { url: `${SITE_URL}/privacy`, priority: 0.1 },
    ...slugs.map((slug) => ({ url: `${SITE_URL}/work/${slug}`, priority: 0.8 })),
  ];
}
