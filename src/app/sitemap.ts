import type { MetadataRoute } from "next";
import { getRoutableSlugs } from "@/lib/catalogue";
import { getRoutableWorkSlugs } from "@/lib/portfolio-queries";
import { getNavPages } from "@/lib/site-pages-queries";
import { getPublishedRevision } from "@/lib/publish";
import { SITE_URL } from "@/lib/site";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, workSlugs, pages, revision] = await Promise.all([
    getRoutableSlugs(),
    getRoutableWorkSlugs(),
    getNavPages(),
    getPublishedRevision(),
  ]);

  /*
    One date for every URL, and that is honest here rather than lazy.

    Publishing writes the whole public site as a single revision, so "page A
    changed but page B did not" is not a state this site can be in — every URL
    was re-asserted at that instant. Per-row timestamps could not answer it
    anyway: a snapshot strips `updatedAt` on the way in, deliberately, so the
    live path has no other date to offer. Absent until the artist has published
    at all, because then the draft is being served and we do not know when she
    last touched it. Never `new Date()`, which would tell Google the whole site
    changed every time a crawler asked.
  */
  const lastModified = revision?.publishedAt ?? undefined;

  return [
    { url: SITE_URL, priority: 1, lastModified },
    { url: `${SITE_URL}/shop`, priority: 0.9, lastModified },
    // Contact is a section of /about now; /contact 308s there and is
    // deliberately absent, so the two are not offered as separate pages.
    { url: `${SITE_URL}/about`, priority: 0.5, lastModified },
    { url: `${SITE_URL}/privacy`, priority: 0.1, lastModified },
    // The artist's own pages, in the order they appear in the top bar.
    ...pages.map((page) => ({ url: `${SITE_URL}/${page.slug}`, priority: 0.7, lastModified })),
    // Only pieces with a page of their own: children compose a page and a
    // piece whose page is switched off would 404. Work shown on a custom page
    // counts, unless that page is still a draft — see getRoutableWorkSlugs.
    ...workSlugs.map((slug) => ({ url: `${SITE_URL}/work/${slug}`, priority: 0.8, lastModified })),
    ...slugs.map((slug) => ({ url: `${SITE_URL}/shop/${slug}`, priority: 0.6, lastModified })),
  ];
}
