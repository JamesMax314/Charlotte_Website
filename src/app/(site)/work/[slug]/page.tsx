import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PortfolioWall } from "@/components/portfolio-wall";
import { getPortfolioItemBySlug, getPublishedWall, getWallTexts } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_SITE_NAME } from "@/lib/default-copy";
import { mergeFonts } from "@/lib/fonts";
import { getSiteFonts } from "@/lib/site-settings";
import { JsonLd } from "@/components/json-ld";
import {
  absoluteUrl,
  metaDescription,
  siteOpenGraph,
  siteTwitter,
  socialImage,
  visualArtworkJsonLd,
} from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { WallScope } from "@/lib/portfolio";
import { getSitePageById } from "@/lib/site-pages-queries";
import { navLabel } from "@/lib/site-pages";

// Reads D1 at request time; see docs/progress.md.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [item, settings] = await Promise.all([getPortfolioItemBySlug(slug), getSiteSettings()]);
  if (!item) return {};

  const siteName = settings.siteName || DEFAULT_SITE_NAME;
  const title = item.name || "Work";
  const description = metaDescription(item.information);
  const cover = item.images[0];
  const { image, card } = socialImage({
    siteName,
    page: cover ?? null,
    faviconKey: settings.faviconKey,
  });

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: `${SITE_URL}/work/${item.slug}` },
    // Built here rather than declared inline: a page's openGraph replaces the
    // layout's outright, so anything this object omits is simply gone.
    openGraph: siteOpenGraph({
      title,
      description,
      path: `/work/${item.slug}`,
      siteName,
      image,
      type: "article",
    }),
    twitter: siteTwitter({ title, description, image, card }),
  };
}

export default async function PortfolioItemPage({ params }: Props) {
  const { slug } = await params;

  // Returns nothing for a draft, a child element, or a piece whose page the
  // artist has switched off — all of which must 404 rather than resolve.
  const item = await getPortfolioItemBySlug(slug);
  if (!item) notFound();

  // Everything on this piece's own wall — inert by construction, because the
  // scope is `piece` rather than `home` or `page`.
  const scope: WallScope = { kind: "piece", id: item.id };
  const [children, texts, settings, fonts, shownOn] = await Promise.all([
    getPublishedWall(scope),
    getWallTexts(scope),
    getSiteSettings(),
    getSiteFonts(),
    // Which wall the visitor came from, so the way back is the way in.
    item.pageId ? getSitePageById(item.pageId) : undefined,
  ]);

  /*
    Back to the wall this piece is shown on, not always to the home page.

    A piece reached from one of the artist's own pages sent the visitor home,
    which silently loses their place — the home wall is not where they were.
    A draft page falls back to home deliberately: this piece's URL still
    resolves while its page does not, so linking to it would offer a 404.
  */
  const back =
    shownOn && shownOn.status === "published"
      ? { href: `/${shownOn.slug}`, label: navLabel(shownOn) }
      : { href: "/", label: "All work" };

  // VisualArtwork only. No Product/Offer markup: nothing here is for sale.
  const cover = item.images[0];
  const jsonLd = visualArtworkJsonLd({
    name: item.name || slug,
    path: `/work/${item.slug}`,
    creatorName: settings.siteName || DEFAULT_SITE_NAME,
    imageUrl: cover ? absoluteUrl(cover.src) : null,
  });

  return (
    <Container>
      <JsonLd nodes={[jsonLd]} />

      <Link href={back.href} className="text-graphite hover:text-accent mb-8 inline-block text-sm">
        ← {back.label}
      </Link>

      {/*
        No fixed heading or description: the artist places those herself as text
        boxes on the wall, so she controls how they sit against the images. The
        name and description are still stored — they carry the page title, the
        meta description and the OG card — they are just not rendered here.
        PortfolioWall promotes her largest text box to the <h1>.
      */}
      <div className="mt-2">
        <PortfolioWall
          items={children}
          texts={texts}
          showNamesOnHover={settings.showNamesOnHover}
          fadeIn={settings.contentFadeIn}
          fonts={mergeFonts(fonts)}
        />
      </div>
    </Container>
  );
}
