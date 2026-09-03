"use client";

import Image from "next/image";
import { useState } from "react";
import { coverImage, type PortfolioItem } from "@/lib/portfolio";
import { FloatingLayer } from "./floating-layer";
import { Icons } from "./context-menu";

/**
 * The archive, opened from "Add from archive" on the canvas menu.
 *
 * A grid of thumbnails rather than a list: the artist is picking a piece back
 * out by how it looks, and a name alone would make two similar photographs
 * indistinguishable. Clicking a thumbnail restores it to where the menu was
 * opened; right-clicking one offers deleting it for good.
 *
 * The delete menu is rendered inline here rather than through `ContextMenu` —
 * that component portals via its own `FloatingLayer`, and this popup is
 * already one: a second portal's pointerdown would land outside this one's
 * ref and close the whole popup before the click on "Delete forever" ever
 * fires. Positioned `fixed` but still a DOM child of this panel, which is what
 * keeps it from reading as an outside click.
 */
export function ArchivePopup({
  x,
  y,
  items,
  onRestore,
  onDeleteForever,
  onClose,
}: {
  x: number;
  y: number;
  items: PortfolioItem[];
  onRestore: (item: PortfolioItem) => void;
  onDeleteForever: (item: PortfolioItem) => void;
  onClose: () => void;
}) {
  const [thumbMenu, setThumbMenu] = useState<{
    x: number;
    y: number;
    item: PortfolioItem;
  } | null>(null);

  return (
    <FloatingLayer x={x} y={y} onClose={onClose} className="w-72 p-3" label="Archive">
      <p className="text-graphite mb-2 text-xs tracking-[0.1em] uppercase">Archive</p>

      {items.length === 0 ? (
        <p className="text-graphite py-4 text-center text-sm">Nothing archived yet.</p>
      ) : (
        <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
          {items.map((item) => {
            const cover = coverImage(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onRestore(item);
                  onClose();
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setThumbMenu({ x: event.clientX, y: event.clientY, item });
                }}
                title={item.name || "Untitled"}
                className="border-line hover:border-accent bg-paper-sunk relative aspect-square overflow-hidden border transition-colors"
              >
                {cover ? (
                  <Image
                    src={cover.src}
                    alt={cover.alt}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-graphite flex h-full items-center justify-center text-xs">
                    No image
                  </span>
                )}
                {item.name && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-white">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {thumbMenu && (
        <>
          {/*
            Closes the inline thumbnail menu on a click anywhere else in the
            popup. `FloatingLayer`'s own outside-click handling only sees
            clicks outside the whole panel, so without this a click on a
            different thumbnail — still inside the panel — would leave the
            menu stuck open over it.
          */}
          <button
            type="button"
            aria-label="Dismiss menu"
            tabIndex={-1}
            onClick={() => setThumbMenu(null)}
            className="fixed inset-0 z-[9999] cursor-default"
          />
          <div
            role="menu"
            aria-label="Archived piece actions"
            className="border-line bg-paper fixed z-[10000] min-w-40 border py-1 shadow-xl"
            style={{ left: thumbMenu.x, top: thumbMenu.y }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDeleteForever(thumbMenu.item);
                setThumbMenu(null);
              }}
              className="hover:bg-paper-sunk flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-red-700 transition-colors"
            >
              <span className="shrink-0">{Icons.trash}</span>
              Delete forever
            </button>
          </div>
        </>
      )}
    </FloatingLayer>
  );
}
