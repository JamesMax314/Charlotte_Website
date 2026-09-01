"use client";

import { useEffect, useRef, useState } from "react";
import { saveArtworkDetails } from "@/app/admin/actions";
import { deleteImage, reorderImages, updateImageAlt } from "@/app/admin/actions";
import type { Artwork, ArtworkDetails } from "@/lib/artworks";
import { isSoldOut, soleListing } from "@/lib/artworks";
import { ImageManager } from "./image-manager";
import { FIELD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./styles";

/** Pence in the database, pounds in the form — as she would write it. */
const toPounds = (pence: number | undefined): string =>
  pence === undefined ? "" : (pence / 100).toFixed(pence % 100 === 0 ? 0 : 2);

const detailsOf = (artwork: Artwork): ArtworkDetails => {
  const listing = soleListing(artwork);
  return {
    title: artwork.title,
    description: artwork.description,
    status: artwork.status,
    label: listing?.label ?? "",
    price: toPounds(listing?.pricePence),
    etsyUrl: listing?.etsyUrl ?? "",
    soldOut: isSoldOut(artwork),
    year: String(artwork.year),
    medium: artwork.medium,
    dimensionsNote: artwork.dimensionsNote ?? "",
    slug: artwork.slug,
  };
};

/**
 * The whole piece in one window — details, what it sells, and its photographs.
 *
 * Opens over the grid rather than navigating, so adding a piece never takes the
 * artist away from the arrangement she is working on. Built on <dialog> like
 * ConfirmDialog: focus trapping, page inertness and Escape come from the
 * platform.
 */
export function ArtworkDialog({
  open,
  artwork,
  isNew,
  onCancel,
  onSaved,
}: {
  open: boolean;
  artwork: Artwork;
  isNew: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const [details, setDetails] = useState<ArtworkDetails>(() => detailsOf(artwork));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the dialog is opened for a different piece.
  const [lastId, setLastId] = useState(artwork.id);
  if (artwork.id !== lastId) {
    setLastId(artwork.id);
    setDetails(detailsOf(artwork));
    setError(null);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = <K extends keyof ArtworkDetails>(key: K, value: ArtworkDetails[K]) =>
    setDetails((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await saveArtworkDetails(artwork.id, details);
      if (result.error) setError(result.error);
      else onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saving failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="border-line bg-paper text-ink m-auto max-h-[90vh] w-[min(56rem,94vw)] overflow-y-auto border p-6 shadow-xl backdrop:bg-black/50"
      aria-label={isNew ? "New piece" : "Edit piece"}
    >
      <div className="flex flex-col gap-5">
        <label className="text-graphite text-xs">
          Title
          <input
            value={details.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
            className={`${FIELD} mt-1 !text-lg`}
          />
        </label>

        <label className="text-graphite text-xs">
          A few words about it
          <textarea
            value={details.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className={`${FIELD} mt-1`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-graphite text-xs">
            What it is
            <input
              value={details.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="A3 giclée print"
              className={`${FIELD} mt-1`}
            />
          </label>

          <label className="text-graphite text-xs">
            Price, in pounds
            <input
              value={details.price}
              onChange={(e) => set("price", e.target.value)}
              inputMode="decimal"
              placeholder="45"
              className={`${FIELD} mt-1`}
            />
          </label>
        </div>

        <label className="text-graphite text-xs">
          Etsy link
          <input
            value={details.etsyUrl}
            onChange={(e) => set("etsyUrl", e.target.value)}
            type="url"
            placeholder="https://www.etsy.com/listing/…"
            className={`${FIELD} mt-1`}
          />
          {/* Blank is meaningful: shown, but not sold (brief P-07). */}
          <span className="mt-1 block">Leave this empty to show the piece without selling it.</span>
        </label>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={details.soldOut}
            onChange={(e) => set("soldOut", e.target.checked)}
            className="accent-accent size-4 shrink-0"
          />
          <span className="text-sm">Sold out</span>
        </label>

        <div className="border-line border-t pt-5">
          <ImageManager
            parentId={artwork.id}
            uploadField="artworkId"
            images={artwork.images.map((image) => ({
              id: image.id,
              src: image.src,
              alt: image.alt,
              width: image.width,
              height: image.height,
            }))}
            reorder={reorderImages}
            updateAlt={updateImageAlt}
            remove={deleteImage}
            hint="Drag an image to the front of the row to make it the main one."
          />
        </div>

        {/*
          Not what she came here for, but the product page and its structured
          data are built from them, so they have to stay editable somewhere.
        */}
        <details className="border-line border-t pt-4">
          <summary className="text-graphite cursor-pointer text-xs">More details</summary>
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-graphite text-xs">
                Year
                <input
                  value={details.year}
                  onChange={(e) => set("year", e.target.value)}
                  inputMode="numeric"
                  className={`${FIELD} mt-1`}
                />
              </label>
              <label className="text-graphite text-xs">
                Medium
                <input
                  value={details.medium}
                  onChange={(e) => set("medium", e.target.value)}
                  placeholder="Ink on paper"
                  className={`${FIELD} mt-1`}
                />
              </label>
            </div>

            <label className="text-graphite text-xs">
              Size of the original
              <input
                value={details.dimensionsNote}
                onChange={(e) => set("dimensionsNote", e.target.value)}
                placeholder="Original 42 × 52 cm"
                className={`${FIELD} mt-1`}
              />
            </label>

            <label className="text-graphite text-xs">
              Web address
              <input
                value={details.slug}
                onChange={(e) => set("slug", e.target.value)}
                className={`${FIELD} mt-1 font-mono`}
              />
            </label>
          </div>
        </details>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="border-line flex flex-wrap items-end justify-between gap-4 border-t pt-5">
          <label className="text-graphite text-xs">
            Who can see it
            <select
              value={details.status}
              onChange={(e) => set("status", e.target.value as ArtworkDetails["status"])}
              className={`${FIELD} mt-1`}
            >
              <option value="draft">Draft — only you</option>
              <option value="published">Published — in the shop</option>
              <option value="archived">Archived — off the shop, link still works</option>
            </select>
          </label>

          <div className="flex items-center gap-3">
            <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className={PRIMARY_BUTTON}>
              {saving ? "Saving…" : "Save listing"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
