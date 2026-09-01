import type { MetadataRoute } from "next";
import { getRoutableSlugs } from "@/lib/catalogue";
import { getRoutableWorkSlugs } from "@/lib/portfolio-queries";
import { getNavPages } from "@/lib/site-pages-queries";
import { SITE_URL } from "@/lib/site";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, workSlugs, pages] = await Promise.all([
    getRoutableSlugs(),
    getRoutableWorkSlugs(),
    getNavPages(),
  ]);

  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/shop`, priority: 0.9 },
    // Contact is a section of /about now; /contact 308s there and is
    // deliberately absent, so the two are not offered as separate pages.
    { url: `${SITE_URL}/about`, priority: 0.5 },
    { url: `${SITE_URL}/privacy`, priority: 0.1 },
    // The artist's own pages, in the order they appear in the top bar.
    ...pages.map((page) => ({ url: `${SITE_URL}/${page.slug}`, priority: 0.7 })),
    // Only pieces with a page of their own: children compose a page and a
    // piece whose page is switched off would 404. Work shown on a custom page
    // counts, unless that page is still a draft — see getRoutableWorkSlugs.
    ...workSlugs.map((slug) => ({ url: `${SITE_URL}/work/${slug}`, priority: 0.8 })),
    ...slugs.map((slug) => ({ url: `${SITE_URL}/shop/${slug}`, priority: 0.6 })),
  ];
}
