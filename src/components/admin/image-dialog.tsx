"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/lib/client-upload";
import { clearPortfolioImages } from "@/app/admin/portfolio-actions";

export interface ImageDetails {
  name: string;
  information: string;
  clickable: boolean;
}

/**
 * Details for one image on the wall.
 *
 * Built on <dialog> like ConfirmDialog: focus trapping, page inertness and
 * Escape come from the platform. It opens over the wall rather than navigating,
 * so the artist keeps her place while adding an image.
 */
export function ImageDialog({
  open,
  itemId,
  initial,
  imageSrc,
  allowClickable,
  onCancel,
  onSave,
}: {
  open: boolean;
  itemId: string;
  initial: ImageDetails;
  imageSrc: string | null;
  /** False on a piece's own page: elements there never link anywhere. */
  allowClickable: boolean;
  onCancel: () => void;
  onSave: (details: ImageDetails) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial.name);
  const [information, setInformation] = useState(initial.information);
  const [clickable, setClickable] = useState(initial.clickable);
  const [preview, setPreview] = useState(imageSrc);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset when the dialog is opened for a different image.
  const [lastId, setLastId] = useState(itemId);
  if (itemId !== lastId) {
    setLastId(itemId);
    setName(initial.name);
    setInformation(initial.information);
    setClickable(initial.clickable);
    setPreview(imageSrc);
    setError(null);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function replaceImage(file: File) {
    setError(null);
    setBusy("Replacing…");
    try {
      await clearPortfolioImages(itemId);
      const uploaded = await uploadImage(file, {
        field: "portfolioItemId",
        parentId: itemId,
        alt: name,
      });
      setPreview(uploaded.src);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const field =
    "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="border-line bg-paper text-ink m-auto w-[min(28rem,92vw)] border p-6 shadow-xl backdrop:bg-black/50"
      aria-label="Image details"
    >
      <div className="flex flex-col gap-4">
        <label className="text-graphite text-xs">
          Title
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Leave blank for a decorative image"
            className={`${field} mt-1 !text-base`}
          />
        </label>

        <div>
          <span className="text-graphite text-xs">Image</span>
          <div className="bg-paper-sunk border-line mt-1 flex max-h-56 justify-center overflow-hidden border">
            {preview ? (
              <Image
                src={preview}
                alt=""
                width={400}
                height={300}
                sizes="400px"
                className="max-h-56 w-auto object-contain"
              />
            ) : (
              <span className="text-graphite p-8 text-xs">No image yet</span>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void replaceImage(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="text-graphite hover:text-accent mt-2 text-xs underline underline-offset-4 disabled:opacity-50"
          >
            {busy ?? "Select a different image"}
          </button>
          {error && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <label className="text-graphite text-xs">
          Description
          <textarea
            value={information}
            onChange={(e) => setInformation(e.target.value)}
            rows={4}
            className={`${field} mt-1`}
          />
        </label>

        {allowClickable && (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={clickable}
              onChange={(e) => setClickable(e.target.checked)}
              className="accent-accent mt-0.5 size-4 shrink-0"
            />
            <span>
              <span className="block text-sm">Make clickable</span>
              <span className="text-graphite block text-xs">
                Visitors can click through to a page of its own, which you build like this one.
                Leave off for a decorative image.
              </span>
            </span>
          </label>
        )}

        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="border-line hover:border-ink border px-4 py-2 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ name, information, clickable })}
            disabled={busy !== null}
            className="bg-accent text-accent-ink hover:bg-ink hover:text-paper px-5 py-2 text-sm transition-colors disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
