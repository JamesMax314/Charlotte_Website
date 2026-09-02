import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { ArtworkViewer } from "@/components/artwork-viewer";
import { BuyPanel } from "@/components/buy-panel";
import { getArtworkBySlug, getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_SITE_NAME } from "@/lib/default-copy";
import { primaryImage, soleListing } from "@/lib/artworks";
import { JsonLd } from "@/components/json-ld";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  metaDescription,
  siteOpenGraph,
  siteTwitter,
  socialImage,
  visualArtworkJsonLd,
} from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [artwork, settings] = await Promise.all([getArtworkBySlug(slug), getSiteSettings()]);
  if (!artwork) return {};

  const siteName = settings.siteName || DEFAULT_SITE_NAME;
  const description = metaDescription(artwork.description);
  const cover = primaryImage(artwork);
  const { image, card } = socialImage({
    siteName,
    page: cover ?? null,
    faviconKey: settings.faviconKey,
  });

  return {
    title: artwork.title,
    ...(description ? { description } : {}),
    alternates: { canonical: `${SITE_URL}/shop/${artwork.slug}` },
    openGraph: siteOpenGraph({
      title: artwork.title,
      description,
      path: `/shop/${artwork.slug}`,
      siteName,
      image,
      type: "article",
    }),
    twitter: siteTwitter({ title: artwork.title, description, image, card }),
  };
}

export default async function ArtworkPage({ params }: Props) {
  const { slug } = await params;
  const [artwork, settings] = await Promise.all([getArtworkBySlug(slug), getSiteSettings()]);

  // Drafts resolve to nothing; archived work still renders (brief P-08, A-09).
  if (!artwork) notFound();

  const listing = soleListing(artwork);

  // VisualArtwork only. No Product/Offer markup: we are not the seller, and
  // claiming an offer we cannot fulfil risks a structured-data penalty (N-03).
  const cover = primaryImage(artwork);
  const jsonLd = visualArtworkJsonLd({
    name: artwork.title,
    path: `/shop/${artwork.slug}`,
    creatorName: settings.siteName || DEFAULT_SITE_NAME,
    artform: artwork.medium,
    dateCreated: String(artwork.year),
    imageUrl: cover ? absoluteUrl(cover.src) : null,
  });

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    { name: artwork.title, path: `/shop/${artwork.slug}` },
  ]);

  return (
    <Container>
      <JsonLd nodes={[jsonLd, crumbs]} />

      <Link
        href="/shop"
        className="text-graphite hover:text-accent mb-8 inline-block text-sm transition-colors"
      >
        ← Shop
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div>
          <ArtworkViewer images={artwork.images} title={artwork.title} />
        </div>

        <div className="lg:sticky lg:top-10 lg:self-start">
          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            {artwork.title}
          </h1>

          <dl className="text-graphite mt-4 space-y-1 text-sm">
            {listing?.label && (
              <div className="flex gap-2">
                <dt className="sr-only">Product type</dt>
                <dd className="text-ink">{listing.label}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="sr-only">Year</dt>
              <dd>{artwork.year}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="sr-only">Medium</dt>
              <dd>{artwork.medium}</dd>
            </div>
            {artwork.dimensionsNote && (
              <div className="flex gap-2">
                <dt className="sr-only">Dimensions</dt>
                <dd>{artwork.dimensionsNote}</dd>
              </div>
            )}
          </dl>

          <p className="mt-6 leading-relaxed text-pretty">{artwork.description}</p>

          {artwork.status === "archived" && (
            <p className="border-line text-graphite mt-6 border-l-2 pl-4 text-sm">
              From the archive. This edition has finished and is kept here for reference.
            </p>
          )}

          <div className="mt-8">
            <BuyPanel artwork={artwork} />
          </div>
        </div>
      </div>
    </Container>
  );
}
