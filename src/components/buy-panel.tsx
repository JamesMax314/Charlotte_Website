import Link from "next/link";
import type { Artwork, Listing } from "@/lib/artworks";
import { isBuyable, soleListing } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";

function EditionNote({ listing }: { listing: Listing }) {
  if (listing.editionSize === undefined || listing.editionSize === null) return null;

  const remaining = listing.editionRemaining ?? 0;
  return (
    <span className="text-graphite text-xs">
      {remaining > 0
        ? `${remaining} of ${listing.editionSize} left`
        : `Edition of ${listing.editionSize}, sold out`}
    </span>
  );
}

/**
 * The handoff to Etsy: one piece, one thing to buy.
 *
 * A piece sells a single product, so there is a single action — the loudest
 * thing on the page. The `listings` table can still hold sizes and formats,
 * and anything beyond the first is simply not offered here.
 */
export function BuyPanel({ artwork }: { artwork: Artwork }) {
  const listing = soleListing(artwork);

  // No listing means the piece is shown but not sold (brief P-07): no empty
  // state, no button that goes nowhere.
  if (!listing) {
    return (
      <p className="text-graphite border-line border-t pt-5 text-sm">
        Not currently available to buy.
      </p>
    );
  }

  // Sold out keeps the page live and offers somewhere to go instead (P-06).
  if (!isBuyable(listing)) {
    return (
      <div className="border-line border-t pt-5">
        <p className="text-sm">Sold out.</p>
        <p className="text-graphite mt-2 text-sm">
          <Link className="hover:text-accent underline underline-offset-4" href="/shop">
            See what else is for sale
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="border-line border-t pt-5">
      <a
        href={listing.etsyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-accent text-accent-ink hover:bg-ink hover:text-paper flex items-center justify-between gap-4 border border-transparent px-5 py-3.5 text-sm transition-colors"
      >
        <span>Buy on Etsy</span>
        <span className="tabular-nums">{formatPrice(listing.pricePence)}</span>
        <span className="sr-only"> — {listing.label} (opens in a new tab)</span>
      </a>

      <div className="mt-2">
        <EditionNote listing={listing} />
      </div>

      {/* Etsy is authoritative; our price is a hook, not a promise (brief P-05). */}
      <p className="text-graphite mt-5 text-xs">Prices and availability are confirmed on Etsy.</p>
    </div>
  );
}
