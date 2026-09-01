import type { Artwork, Listing } from "@/lib/artworks";
import { isBuyable } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";

function EditionNote({ listing }: { listing: Listing }) {
  if (listing.editionSize === undefined) return null;

  const remaining = listing.editionRemaining ?? 0;
  return (
    <span className="text-graphite text-xs">
      {remaining > 0
        ? `${remaining} of ${listing.editionSize} left`
        : `Edition of ${listing.editionSize}, sold out`}
    </span>
  );
}

function ListingRow({ listing, isPrimary }: { listing: Listing; isPrimary: boolean }) {
  if (!isBuyable(listing)) {
    return (
      <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-graphite line-through">{listing.label}</span>
        <span className="text-graphite text-sm">Sold out</span>
      </li>
    );
  }

  // One primary action per panel. A £12 download rendered as loudly as a £65
  // print makes the reader choose between two shouts.
  const style = isPrimary
    ? "bg-accent text-accent-ink hover:bg-ink hover:text-paper border border-transparent"
    : "border-line text-ink hover:border-ink border bg-transparent";

  return (
    <li className="flex flex-col gap-1.5">
      <a
        href={listing.etsyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors ${style}`}
      >
        <span>Buy on Etsy</span>
        <span className="tabular-nums">{formatPrice(listing.pricePence)}</span>
        <span className="sr-only"> — {listing.label} (opens in a new tab)</span>
      </a>
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-graphite text-xs">{listing.label}</span>
        <EditionNote listing={listing} />
      </span>
    </li>
  );
}

export function BuyPanel({ artwork }: { artwork: Artwork }) {
  // No listing means the piece is shown but not sold (brief P-07).
  if (artwork.listings.length === 0) {
    return (
      <p className="text-graphite border-line border-t pt-5 text-sm">
        Not currently available as a print.
      </p>
    );
  }

  const primaryId = artwork.listings.find(isBuyable)?.id;

  return (
    <div className="border-line border-t pt-5">
      <ul className="flex flex-col gap-5">
        {artwork.listings.map((listing) => (
          <ListingRow key={listing.id} listing={listing} isPrimary={listing.id === primaryId} />
        ))}
      </ul>
      {/* Etsy is authoritative; our price is a hook, not a promise (brief P-05). */}
      <p className="text-graphite mt-5 text-xs">Prices and availability are confirmed on Etsy.</p>
    </div>
  );
}
