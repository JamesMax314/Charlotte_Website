import type { MetadataRoute } from "next";
import { getRoutableSlugs } from "@/lib/catalogue";
import { getPublishedPortfolio } from "@/lib/portfolio-queries";
import { SITE_URL } from "@/lib/site";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, portfolio] = await Promise.all([getRoutableSlugs(), getPublishedPortfolio()]);

  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/about`, priority: 0.5 },
    { url: `${SITE_URL}/contact`, priority: 0.5 },
    { url: `${SITE_URL}/privacy`, priority: 0.1 },
    ...portfolio.map((item) => ({ url: `${SITE_URL}/work/${item.slug}`, priority: 0.8 })),
    ...slugs.map((slug) => ({ url: `${SITE_URL}/shop/${slug}`, priority: 0.6 })),
  ];
}
