"use client";

import type { ListingKind } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";
import {
  defaultFilter,
  isDefaultFilter,
  type PriceBounds,
  type ShopFilter,
} from "@/lib/shop-filter";

/** Whole pounds. Pence on a slider is precision nobody is shopping with. */
const STEP = 100;

const TYPES: { label: string; kinds: ListingKind[] }[] = [
  { label: "Everything", kinds: [] },
  { label: "Prints", kinds: ["print"] },
  { label: "Downloads", kinds: ["digital"] },
];

const sameKinds = (a: ListingKind[], b: ListingKind[]) =>
  a.length === b.length && a.every((kind) => b.includes(kind));

export function ShopFilters({
  filter,
  bounds,
  onChange,
}: {
  filter: ShopFilter;
  bounds: PriceBounds;
  onChange: (next: ShopFilter) => void;
}) {
  // Nothing to slide when every piece costs the same — or when the shop is
  // empty, where the two bounds meet at zero and the track has no length.
  const hasSpread = bounds.maxPence > bounds.minPence;
  const span = bounds.maxPence - bounds.minPence;
  const percent = (pence: number) => ((pence - bounds.minPence) / span) * 100;

  const field =
    "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <div className="border-line mb-10 flex flex-col gap-6 border-y py-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-8">
      <label className="flex min-w-52 flex-1 flex-col gap-1.5">
        <span className="text-graphite text-xs">Search</span>
        <input
          type="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Title, medium, a word from the description"
          className={field}
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-graphite mb-1.5 text-xs">Type</legend>
        <div className="flex">
          {TYPES.map(({ label, kinds }) => {
            const active = sameKinds(filter.kinds, kinds);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filter, kinds })}
                className={`border-line -ml-px border px-3 py-2 text-sm transition-colors first:ml-0 ${
                  active ? "bg-ink text-paper border-ink" : "hover:border-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {hasSpread && (
        <fieldset className="flex w-full flex-col gap-1.5 sm:w-56">
          <legend className="text-graphite mb-1.5 text-xs">
            Price · {formatPrice(filter.minPence)} to {formatPrice(filter.maxPence)}
          </legend>

          {/*
            Both handles share one track, so the inputs are stacked. Only the
            thumbs take the pointer — see .price-range in globals.css, without
            which the input on top swallows every drag meant for the one under it.
          */}
          <div className="price-range relative h-6">
            <div className="bg-line absolute top-1/2 h-px w-full -translate-y-1/2" />
            <div
              className="bg-ink absolute top-1/2 h-px -translate-y-1/2"
              style={{
                left: `${percent(filter.minPence)}%`,
                right: `${100 - percent(filter.maxPence)}%`,
              }}
            />
            <input
              type="range"
              aria-label="Lowest price"
              min={bounds.minPence}
              max={bounds.maxPence}
              step={STEP}
              value={filter.minPence}
              onChange={(e) =>
                onChange({ ...filter, minPence: Math.min(Number(e.target.value), filter.maxPence) })
              }
              className="absolute inset-0 w-full"
            />
            <input
              type="range"
              aria-label="Highest price"
              min={bounds.minPence}
              max={bounds.maxPence}
              step={STEP}
              value={filter.maxPence}
              onChange={(e) =>
                onChange({ ...filter, maxPence: Math.max(Number(e.target.value), filter.minPence) })
              }
              className="absolute inset-0 w-full"
            />
          </div>
        </fieldset>
      )}

      {!isDefaultFilter(filter, bounds) && (
        <button
          type="button"
          onClick={() => onChange(defaultFilter(bounds))}
          className="text-graphite hover:text-accent self-start pb-2 text-sm transition-colors sm:self-end"
        >
          Clear
        </button>
      )}
    </div>
  );
}
