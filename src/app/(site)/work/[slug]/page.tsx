import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { getPortfolioItemBySlug } from "@/lib/portfolio-queries";
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
    title: item.name,
    description: item.information.slice(0, 200),
    alternates: { canonical: `${SITE_URL}/work/${item.slug}` },
    openGraph: {
      title: item.name,
      description: item.information.slice(0, 200),
      ...(cover ? { images: [{ url: cover.src }] } : {}),
    },
  };
}

export default async function PortfolioItemPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPortfolioItemBySlug(slug);
  if (!item) notFound();

  // VisualArtwork only. No Product/Offer markup: nothing here is for sale.
  const cover = item.images[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: item.name,
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
          {item.name}
        </h1>
        {item.information && (
          <p className="mt-5 leading-relaxed text-pretty whitespace-pre-line">{item.information}</p>
        )}
      </div>

      {/*
        A piece can be a whole project, so every image is shown at full width in
        the artist's order rather than hidden behind a gallery control.
      */}
      <div className="mt-10 flex flex-col gap-10">
        {item.images.map((image, i) => (
          <figure key={image.id} className="bg-paper-sunk border-line border">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              priority={i === 0}
              sizes="(min-width: 1280px) 1152px, 100vw"
              className="h-auto w-full"
            />
          </figure>
        ))}
      </div>

      {item.images.length === 0 && (
        <p className="border-line text-graphite mt-10 border border-dashed px-6 py-16 text-center text-sm">
          Photographs coming soon.
        </p>
      )}
    </Container>
  );
}
