"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtworkImage } from "@/lib/artworks";

const ARROW =
  "bg-paper/85 border-line text-ink hover:bg-paper absolute top-1/2 -translate-y-1/2 border p-2 transition-colors";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d={direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * The artwork images, with a lightbox.
 *
 * Built on <dialog> deliberately: showModal() gives focus trapping, inertness of
 * the page behind, and Esc-to-close from the platform, all of which are easy to
 * get subtly wrong by hand.
 */
export function ArtworkViewer({ images, title }: { images: ArtworkImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const count = images.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const active = images[index];

  // The artist can publish before uploading photographs.
  if (!active) {
    return (
      <div className="bg-paper-sunk border-line text-graphite flex aspect-[4/5] items-center justify-center border text-sm">
        Photograph coming soon
      </div>
    );
  }

  return (
    <>
      {/*
        The arrows are siblings of the zoom button, not children of it: nested
        inside, every press to cycle would open the lightbox as well.
      */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-paper-sunk border-line block w-full cursor-zoom-in overflow-hidden border"
          aria-label={`View ${title} larger`}
        >
          <Image
            src={active.src}
            alt={active.alt}
            width={active.width}
            height={active.height}
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="h-auto w-full"
          />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className={`${ARROW} left-2`}
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className={`${ARROW} right-2`}
            >
              <Chevron direction="right" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {images.map((image, i) => (
            <li key={image.src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                aria-label={`Show image ${i + 1} of ${count}`}
                className={`bg-paper-sunk block h-16 w-16 overflow-hidden border transition-colors ${
                  i === index ? "border-ink" : "hover:border-line border-transparent"
                }`}
              >
                <Image
                  src={image.src}
                  alt=""
                  width={image.width}
                  height={image.height}
                  sizes="64px"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(1);
          if (event.key === "ArrowLeft") go(-1);
        }}
        className="text-paper max-h-dvh max-w-none bg-transparent p-0 backdrop:cursor-zoom-out"
        aria-label={`${title}, enlarged`}
      >
        <div className="flex h-dvh w-dvw flex-col">
          <div className="flex shrink-0 items-center justify-between px-5 py-4">
            <p className="text-sm">
              {title}
              {count > 1 && (
                <span className="opacity-60">
                  {" "}
                  · {index + 1}/{count}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1 text-sm underline underline-offset-4"
            >
              Close
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-5">
            <Image
              src={active.src}
              alt={active.alt}
              width={active.width}
              height={active.height}
              sizes="100vw"
              className="max-h-full w-auto max-w-full object-contain"
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
    </>
  );
}
