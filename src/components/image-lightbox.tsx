"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * One image in a lightbox.
 *
 * `caption` is per image rather than per lightbox because the two callers
 * differ: the shop shows one artwork's title over every one of its
 * photographs, while the wall shows a different piece's name for each. Passing
 * the same string for every image gives the shop's behaviour exactly.
 */
export interface LightboxImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** May be blank — a decorative wall image has no title. */
  caption: string;
}

/**
 * The full-screen image view, shared by the shop and the wall.
 *
 * Built on <dialog> deliberately: showModal() gives focus trapping, inertness
 * of the page behind, and Esc-to-close from the platform, all of which are
 * easy to get subtly wrong by hand.
 *
 * Extracted from ArtworkViewer rather than copied for the wall. The brief for
 * the wall's lightbox was "identical to the shop", and two components that are
 * meant to look the same forever are one component; a copy would have drifted
 * the first time either was touched.
 *
 * Stateless about which image is showing. Both callers already own an index —
 * the shop shares it with its thumbnail strip, the wall derives it from the
 * piece that was tapped — and a second copy in here could disagree with it.
 */
export function ImageLightbox({
  images,
  index,
  open,
  onIndex,
  onClose,
  label,
}: {
  images: LightboxImage[];
  index: number;
  open: boolean;
  /** Called with the new index when the visitor cycles. */
  onIndex: (index: number) => void;
  onClose: () => void;
  /** The dialog's accessible name. */
  label: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const count = images.length;
  const active = images[index];

  const go = (delta: number) => onIndex((index + delta + count) % count);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!active) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
      className="text-paper max-h-dvh max-w-none bg-transparent p-0 backdrop:cursor-zoom-out"
      aria-label={label}
    >
      {/*
        Clicking beside the photograph closes it.

        Not the `::backdrop` doing this work: the dialog is sized to the whole
        viewport, so there is no backdrop left for a visitor to reach, and the
        grey the visitor reads as "outside" is the empty space inside this
        element. `backdrop:cursor-zoom-out` on the dialog therefore never shows
        either, which is why the cursor is declared again here.

        Anything that is not the picture or a control counts as outside, the
        caption included — a title is not a thing to click, and the alternative
        is a dead zone across the top of the screen.
      */}
      <div
        className="flex h-dvh w-dvw cursor-zoom-out flex-col"
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest("img, button")) onClose();
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          {/*
            The separator belongs to the counter, not to the caption: an
            untitled wall image would otherwise open on a leading " · ".
          */}
          <p className="text-sm">
            {active.caption}
            {count > 1 && (
              <span className="opacity-60">
                {active.caption ? " · " : ""}
                {index + 1}/{count}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-sm underline underline-offset-4"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-5">
          {/*
            Eager, and it has to be.

            `w-auto` on an image that has not loaded computes to 0px, and an
            element of zero size never intersects the viewport — so the lazy
            observer never fires, the image never loads, and it stays 0px. The
            deadlock only broke when something else forced a re-layout, which
            is why it looked like an intermittently slow image rather than a
            bug. Nothing is preloaded by this: a dialog that is never opened
            never renders, and by the time it does the visitor has asked for
            this exact picture. `priority` would be the wrong tool — that
            preloads from the page that owns the lightbox.
          */}
          <Image
            src={active.src}
            alt={active.alt}
            width={active.width}
            height={active.height}
            loading="eager"
            sizes="100vw"
            className="max-h-full w-auto max-w-full cursor-default object-contain"
          />
        </div>

        {count > 1 && (
          <div className="flex shrink-0 justify-center gap-6 pb-6 text-sm">
            <button type="button" onClick={() => go(-1)} className="underline underline-offset-4">
              Previous
            </button>
            <button type="button" onClick={() => go(1)} className="underline underline-offset-4">
              Next
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
