"use client";

import { useMemo, useState } from "react";
import type { Artwork } from "@/lib/artworks";
import { searchArtworks } from "@/lib/shop-filter";
import { ArtworkGrid } from "./artwork-grid";

/**
 * The shop index, searched in the browser.
 *
 * The catalogue is under fifty pieces (brief P-02), so the whole of it comes
 * down with the page and narrowing costs nothing — no query parameters, and no
 * trip back to D1 between keystrokes.
 */
export function ShopBrowser({ artworks }: { artworks: Artwork[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => searchArtworks(artworks, query), [artworks, query]);

  return (
    <>
      <div className="border-line mb-8 flex flex-wrap items-end gap-4 border-y py-5">
        <label className="flex min-w-52 flex-1 flex-col gap-1.5">
          <span className="text-graphite text-xs">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, medium, a word from the description"
            className="border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </label>

        {query.trim() !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-graphite hover:text-accent pb-2 text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-graphite mb-8 text-xs" aria-live="polite">
        {shown.length === artworks.length
          ? `${artworks.length} ${artworks.length === 1 ? "piece" : "pieces"}`
          : `${shown.length} of ${artworks.length} pieces`}
      </p>

      {shown.length === 0 ? (
        <p className="border-line text-graphite border border-dashed px-6 py-16 text-center text-sm">
          Nothing here matches that.
        </p>
      ) : (
        <ArtworkGrid artworks={shown} />
      )}
    </>
  );
}
