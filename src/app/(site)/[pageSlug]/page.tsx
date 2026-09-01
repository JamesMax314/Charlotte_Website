import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PortfolioWall } from "@/components/portfolio-wall";
import { getPublishedWall, getWallTexts } from "@/lib/portfolio-queries";
import { getPublishedSitePageBySlug } from "@/lib/site-pages-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { mergeFonts } from "@/lib/fonts";
import type { WallScope } from "@/lib/portfolio";
import { getSiteFonts } from "@/lib/site-settings";
import { SITE_URL } from "@/lib/site";

/**
 * One of the artist's own pages, at the top level of the site.
 *
 * A single dynamic segment here catches every unmatched one-segment URL, which
 * is why `RESERVED_PAGE_SLUGS` exists: Next resolves `/about` and `/shop` to
 * their static routes before it reaches this one, so a page allowed to take
 * those names would be editable and permanently unreachable. Anything that is
 * not a published page 404s, exactly as it did before this route existed.
 */

// Reads D1 at request time; see docs/progress.md.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ pageSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pageSlug } = await params;
  const page = await getPublishedSitePageBySlug(pageSlug);
  if (!page) return {};

  return {
    title: page.title,
    alternates: { canonical: `${SITE_URL}/${page.slug}` },
    openGraph: { title: page.title },
  };
}

export default async function CustomPage({ params }: Props) {
  const { pageSlug } = await params;

  const page = await getPublishedSitePageBySlug(pageSlug);
  if (!page) notFound();

  const scope: WallScope = { kind: "page", id: page.id };
  const [items, texts, settings, fonts] = await Promise.all([
    getPublishedWall(scope),
    getWallTexts(scope),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  /*
    No rendered heading, for the same reason the home page has none: the artist
    composes the page out of text boxes and images, and a fixed title above
    them would fight whatever she arranged. The stored title carries the
    browser tab and the nav label, and PortfolioWall promotes her largest text
    box to the <h1>.
  */
  return (
    <Container>
      <PortfolioWall
        items={items}
        texts={texts}
        showNamesOnHover={settings.showNamesOnHover}
        fadeIn={settings.contentFadeIn}
        fonts={mergeFonts(fonts)}
      />
    </Container>
  );
}
