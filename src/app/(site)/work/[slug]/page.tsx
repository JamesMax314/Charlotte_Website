import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { ArtworkViewer } from "@/components/artwork-viewer";
import { BuyPanel } from "@/components/buy-panel";
import { getArtworkBySlug } from "@/lib/catalogue";
import { primaryImage } from "@/lib/artworks";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);
  if (!artwork) return {};

  const image = primaryImage(artwork);

  return {
    title: artwork.title,
    description: artwork.description,
    alternates: { canonical: `${SITE_URL}/work/${artwork.slug}` },
    openGraph: {
      title: artwork.title,
      description: artwork.description,
      ...(image ? { images: [{ url: image.src }] } : {}),
    },
  };
}

export default async function ArtworkPage({ params }: Props) {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);

  // Drafts resolve to nothing; archived work still renders (brief P-08, A-09).
  if (!artwork) notFound();

  // VisualArtwork only. No Product/Offer markup: we are not the seller, and
  // claiming an offer we cannot fulfil risks a structured-data penalty (N-03).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artwork.title,
    artform: artwork.medium,
    dateCreated: String(artwork.year),
    creator: { "@type": "Person", name: "Charlotte" },
    ...(primaryImage(artwork) ? { image: `${SITE_URL}${primaryImage(artwork)!.src}` } : {}),
    url: `${SITE_URL}/work/${artwork.slug}`,
  };

  return (
    <Container className="pt-10 pb-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="text-graphite hover:text-accent mb-8 inline-block text-sm transition-colors"
      >
        ← All work
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
