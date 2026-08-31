import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/lib/artworks";
import { headlinePricePence, isSoldOut } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";

export function ArtworkCard({
  artwork,
  priority = false,
}: {
  artwork: Artwork;
  priority?: boolean;
}) {
  const image = artwork.images[0];
  const from = headlinePricePence(artwork);
  const soldOut = isSoldOut(artwork);

  return (
    <article className="mb-14 break-inside-avoid">
      <Link href={`/work/${artwork.slug}`} className="group block">
        <div className="bg-paper-sunk border-line overflow-hidden border">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            priority={priority}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.015]"
          />
        </div>

        {/* The print margin: title left, what it costs right. */}
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="font-display group-hover:text-biro text-base tracking-tight transition-colors">
            {artwork.title}
          </h3>
          <span className="text-graphite shrink-0 text-xs tabular-nums">
            {soldOut ? "Sold out" : from !== null ? `From ${formatPrice(from)}` : artwork.year}
          </span>
        </div>
        <p className="text-graphite mt-1 text-xs">{artwork.medium}</p>
      </Link>
    </article>
  );
}
