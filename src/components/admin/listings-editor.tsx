"use client";

import { useActionState, useState } from "react";
import type { Listing } from "@/lib/artworks";
import { deleteListing, saveListing } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";

function ListingForm({
  artworkId,
  listing,
  onDone,
}: {
  artworkId: string;
  listing?: Listing;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    saveListing.bind(null, artworkId),
    {} as {
      error?: string;
    },
  );

  if (state && "ok" in state && state.ok) onDone();

  const field =
    "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <form action={action} className="border-line flex flex-col gap-3 border p-4">
      <input type="hidden" name="listingId" value={listing?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-graphite text-xs">
          What is it
          <select name="kind" defaultValue={listing?.kind ?? "print"} className={`${field} mt-1`}>
            <option value="print">Print (you post it)</option>
            <option value="digital">Digital download</option>
          </select>
        </label>

        <label className="text-graphite text-xs">
          Size or name
          <input
            name="label"
            defaultValue={listing?.label ?? ""}
            placeholder="A2 giclée print"
            required
            className={`${field} mt-1`}
          />
        </label>
      </div>

      <label className="text-graphite text-xs">
        Etsy link
        <input
          name="etsyUrl"
          type="url"
          defaultValue={listing?.etsyUrl ?? ""}
          placeholder="https://www.etsy.com/uk/listing/…"
          required
          className={`${field} mt-1`}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-graphite text-xs">
          Price (£)
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={listing ? (listing.pricePence / 100).toFixed(2) : ""}
            required
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-graphite text-xs">
          Edition of
          <input
            name="editionSize"
            type="number"
            min="1"
            defaultValue={listing?.editionSize ?? ""}
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-graphite text-xs">
          Left
          <input
            name="editionRemaining"
            type="number"
            min="0"
            defaultValue={listing?.editionRemaining ?? ""}
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-graphite text-xs">
          Availability
          <select
            name="availability"
            defaultValue={listing?.availability ?? "available"}
            className={`${field} mt-1`}
          >
            <option value="available">For sale</option>
            <option value="sold_out">Sold out</option>
          </select>
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-paper hover:bg-ink px-4 py-2 text-sm transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-graphite px-2 text-sm underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ListingsEditor({
  artworkId,
  listings,
}: {
  artworkId: string;
  listings: Listing[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <h2 className="font-display text-lg tracking-tight">Where to buy it</h2>
      <p className="text-graphite mt-1 mb-4 text-xs">
        Each size or format links to its own Etsy listing. Leave this empty to show the piece
        without selling it.
      </p>

      <ul className="mb-4 flex flex-col gap-3">
        {listings.map((listing) => (
          <li key={listing.id}>
            {editing === listing.id ? (
              <ListingForm
                artworkId={artworkId}
                listing={listing}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="border-line flex flex-wrap items-baseline justify-between gap-3 border px-4 py-3">
                <span className="text-sm">
                  {listing.label}
                  <span className="text-graphite"> · {formatPrice(listing.pricePence)}</span>
                  {listing.availability === "sold_out" && (
                    <span className="text-graphite"> · sold out</span>
                  )}
                </span>
                <span className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditing(listing.id)}
                    className="underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteListing(listing.id)}
                    className="text-graphite underline underline-offset-2 hover:text-red-700"
                  >
                    Remove
                  </button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <ListingForm artworkId={artworkId} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border-line hover:border-ink border px-4 py-2 text-sm transition-colors"
        >
          Add a size or format
        </button>
      )}
    </section>
  );
}
