import type { Artwork } from "@/lib/artworks";
import { ArtworkCard } from "./artwork-card";

/**
 * Column flow rather than a fixed grid, so every piece keeps its true aspect
 * ratio instead of being cropped to a uniform tile.
 */
export function ArtworkGrid({ artworks }: { artworks: Artwork[] }) {
  return (
    <div className="columns-1 gap-x-10 sm:columns-2 lg:columns-3">
      {artworks.map((artwork, i) => (
        <ArtworkCard key={artwork.slug} artwork={artwork} priority={i < 2} />
      ))}
    </div>
  );
}
