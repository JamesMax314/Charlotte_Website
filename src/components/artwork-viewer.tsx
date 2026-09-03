"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import type { ArtworkImage } from "@/lib/artworks";
import { ImageLightbox } from "./image-lightbox";

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
 * The full-screen view itself is `ImageLightbox`, shared with the portfolio
 * wall. The gallery around it — the arrows over the main image and the
 * thumbnail strip — stays here, because it is the shop's alone: a wall element
 * holds exactly one image.
 */
export function ArtworkViewer({ images, title }: { images: ArtworkImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const count = images.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

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
            // Only the main image. The 64px thumbnails below arrive faster
            // than a placeholder for them would be worth, and blurring a
            // strip of them reads as a fault rather than as loading.
            {...(active.lqip ? { placeholder: "blur" as const, blurDataURL: active.lqip } : {})}
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

      <ImageLightbox
        images={images.map((image) => ({ ...image, caption: title }))}
        index={index}
        open={isOpen}
        onIndex={setIndex}
        onClose={() => setIsOpen(false)}
        label={`${title}, enlarged`}
      />
    </>
  );
}
