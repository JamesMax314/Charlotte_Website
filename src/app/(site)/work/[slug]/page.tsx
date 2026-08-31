import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PortfolioWall } from "@/components/portfolio-wall";
import {
  getPortfolioItemBySlug,
  getPublishedChildren,
  getWallTexts,
} from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site";

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

  const [children, texts, settings] = await Promise.all([
    getPublishedChildren(item.id),
    getWallTexts(item.id),
    getSiteSettings(),
  ]);

  // VisualArtwork only. No Product/Offer markup: nothing here is for sale.
  const cover = item.images[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: item.name || slug,
    creator: { "@type": "Person", name: "Charlotte Wilkinson" },
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

      <div className="max-w-3xl">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
          {item.name || "Untitled"}
        </h1>
        {item.information && (
          <p className="mt-5 leading-relaxed text-pretty whitespace-pre-line">{item.information}</p>
        )}
      </div>

      {/*
        The piece's own page, composed on the same wall as the home page. Its
        elements are inert: they are part of this page, not links onward.
      */}
      <div className="mt-10">
        <PortfolioWall
          items={children}
          texts={texts}
          showNamesOnHover={settings.showNamesOnHover}
        />
      </div>
    </Container>
  );
}
