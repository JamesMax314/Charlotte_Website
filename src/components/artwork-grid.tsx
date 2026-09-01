import type { Artwork } from "@/lib/artworks";
import { ArtworkCard } from "./artwork-card";

/**
 * The shop grid. Uniform tiles, so a plain grid rather than the column flow
 * the portfolio needs — every card is already the same 3:4 rectangle.
 *
 * Only the first two are eager. The rest stay lazy whatever the viewport,
 * because `loading="lazy"` does not defer an image that is already on screen
 * — it defers only what the visitor cannot see (see docs/progress.md).
 */
export function ArtworkGrid({ artworks }: { artworks: Artwork[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {artworks.map((artwork, i) => (
        <ArtworkCard key={artwork.slug} artwork={artwork} priority={i < 2} />
      ))}
    </div>
  );
}
