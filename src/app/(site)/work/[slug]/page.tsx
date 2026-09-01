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
import { SITE_URL } from "@/lib/site";
import type { WallScope } from "@/lib/portfolio";

// Reads D1 at request time; see docs/progress.md.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPortfolioItemBySlug(slug);
  if (!item) return {};

  const cover = item.images[0];
  return {
    title: item.name || "Work",
    description: item.information.slice(0, 200),
    alternates: { canonical: `${SITE_URL}/work/${item.slug}` },
    openGraph: {
      title: item.name || "Work",
      description: item.information.slice(0, 200),
      ...(cover ? { images: [{ url: cover.src }] } : {}),
    },
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
  const [children, texts, settings, fonts] = await Promise.all([
    getPublishedWall(scope),
    getWallTexts(scope),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  // VisualArtwork only. No Product/Offer markup: nothing here is for sale.
  const cover = item.images[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: item.name || slug,
    creator: { "@type": "Person", name: settings.siteName || DEFAULT_SITE_NAME },
    ...(cover ? { image: `${SITE_URL}${cover.src}` } : {}),
    url: `${SITE_URL}/work/${item.slug}`,
  };

  return (
    <Container className="pt-10 pb-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/" className="text-graphite hover:text-accent mb-8 inline-block text-sm">
        ← All work
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
