import type { MetadataRoute } from "next";
import { getRoutableSlugs } from "@/lib/artworks";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getRoutableSlugs();

  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/work`, priority: 0.9 },
    { url: `${SITE_URL}/about`, priority: 0.5 },
    { url: `${SITE_URL}/contact`, priority: 0.5 },
    { url: `${SITE_URL}/privacy`, priority: 0.1 },
    ...slugs.map((slug) => ({ url: `${SITE_URL}/work/${slug}`, priority: 0.8 })),
  ];
}
