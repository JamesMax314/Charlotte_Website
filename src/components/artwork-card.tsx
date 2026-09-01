import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/lib/artworks";
import { isSoldOut, primaryImage, productTypeLabel, soleListing } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";

/**
 * One product in the shop grid.
 *
 * Every tile is the same 3:4 rectangle whatever shape the photograph is, so
 * the grid reads as a catalogue rather than a wall — the piece's true
 * proportions are the product page's job.
 */
export function ArtworkCard({
  artwork,
  priority = false,
}: {
  artwork: Artwork;
  priority?: boolean;
}) {
  const image = primaryImage(artwork);
  const listing = soleListing(artwork);
  const soldOut = isSoldOut(artwork);

  return (
    <article>
      <Link href={`/shop/${artwork.slug}`} className="group block">
        <div className="bg-paper-sunk border-line relative aspect-[3/4] overflow-hidden border">
          {image ? (
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              priority={priority}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
            />
          ) : (
            <div className="text-graphite flex h-full items-center justify-center px-4 text-center text-xs">
              Photograph coming soon
            </div>
          )}

          {soldOut && (
            <span className="bg-ink/80 text-paper absolute top-2 left-2 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
              Sold out
            </span>
          )}
        </div>

        {/* The print margin: title left, what it costs right. */}
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <h3 className="font-display group-hover:text-accent text-base tracking-tight transition-colors">
            {artwork.title}
          </h3>
          {listing && (
            <span className="shrink-0 text-sm tabular-nums">{formatPrice(listing.pricePence)}</span>
          )}
        </div>
        <p className="text-graphite mt-0.5 text-xs">
          {listing ? productTypeLabel(listing.kind) : artwork.medium}
        </p>
      </Link>
    </article>
  );
}
