"use client";

import { useMemo, useState } from "react";
import type { Artwork } from "@/lib/artworks";
import { defaultFilter, filterArtworks, priceBounds, type ShopFilter } from "@/lib/shop-filter";
import { ArtworkGrid } from "./artwork-grid";
import { ShopFilters } from "./shop-filters";

/**
 * The shop index, filtered in the browser.
 *
 * The catalogue is under fifty pieces (brief P-02), so the whole of it comes
 * down with the page and narrowing costs nothing — no query parameters, and no
 * trip back to D1 between keystrokes.
 */
export function ShopBrowser({ artworks }: { artworks: Artwork[] }) {
  const bounds = useMemo(() => priceBounds(artworks), [artworks]);
  const [filter, setFilter] = useState<ShopFilter>(() => defaultFilter(bounds));

  const shown = useMemo(() => filterArtworks(artworks, filter, bounds), [artworks, filter, bounds]);

  return (
    <>
      <ShopFilters filter={filter} bounds={bounds} onChange={setFilter} />

      <p className="text-graphite mb-8 text-xs" aria-live="polite">
        {shown.length === artworks.length
          ? `${artworks.length} ${artworks.length === 1 ? "piece" : "pieces"}`
          : `${shown.length} of ${artworks.length} pieces`}
      </p>

      {shown.length === 0 ? (
        <p className="border-line text-graphite border border-dashed px-6 py-16 text-center text-sm">
          Nothing here matches that. Try clearing the filters.
        </p>
      ) : (
        <ArtworkGrid artworks={shown} />
      )}
    </>
  );
}
