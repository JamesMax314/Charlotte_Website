"use client";

import { createContext, useContext, useState } from "react";
import { ImageLightbox, type LightboxImage } from "./image-lightbox";

/** One zoomable image on a wall, in the order the lightbox cycles them. */
export interface WallZoomImage extends LightboxImage {
  /** The piece's id, which is what a trigger names itself by. */
  id: string;
}

/**
 * Opening the lightbox, by piece id.
 *
 * Null outside a provider, which is the case on a wall that has no zoomable
 * images at all — there, `PortfolioWall` renders no triggers either, so this
 * is belt and braces rather than a live path.
 */
const WallZoomContext = createContext<((id: string) => void) | null>(null);

/**
 * The lightbox for a wall, and the state of which image it is showing.
 *
 * Wraps the wall rather than living inside it. The lightbox cycles every
 * zoomable image on the page — not just the one tapped — so the list has to be
 * owned above the individual elements, and a client component that takes the
 * server-rendered wall as `children` keeps all of that markup on the server.
 * Only this file and its triggers reach the browser.
 *
 * Renders a fragment, so nothing is interposed between the wall and its
 * parent: `.wall` positions its children absolutely and an extra wrapper here
 * would be a new containing block. The closed <dialog> is a sibling and
 * `display: none` until it opens.
 */
export function WallZoom({
  images,
  children,
}: {
  images: WallZoomImage[];
  children: React.ReactNode;
}) {
  // Null is closed. Kept as one piece of state rather than an index plus a
  // boolean, so there is no arrangement of the two that means nothing.
  const [openId, setOpenId] = useState<string | null>(null);

  // Clamped to 0 so the lightbox has a valid image to unmount with while the
  // dialog plays its close: `openId` is cleared before the element goes away.
  const index = Math.max(
    0,
    images.findIndex((image) => image.id === openId),
  );

  return (
    <WallZoomContext.Provider value={setOpenId}>
      {children}
      <ImageLightbox
        images={images}
        index={index}
        open={openId !== null}
        onIndex={(next) => setOpenId(images[next]?.id ?? null)}
        onClose={() => setOpenId(null)}
        label={
          images[index]?.caption
            ? `${images[index].caption}, enlarged`
            : `Image ${index + 1} of ${images.length}, enlarged`
        }
      />
    </WallZoomContext.Provider>
  );
}

/**
 * A wall image that opens full screen when tapped.
 *
 * Takes the picture as `children` so the <Image> stays server-rendered, with
 * its width ladder and its loading priority decided where the rest of the
 * wall's are. Deliberately a <button>: this is not navigation, so a link would
 * offer a URL that does not exist and lie to the middle-click.
 *
 * A zoom cursor is the whole affordance, matching the shop's main image. There
 * is no hover overlay — `showsHoverName` still requires `isInteractive`, so a
 * name on hover continues to mean "this goes somewhere".
 */
export function ZoomTrigger({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  const open = useContext(WallZoomContext);
  if (!open) return <div className="relative block overflow-hidden">{children}</div>;

  return (
    <button
      type="button"
      onClick={() => open(id)}
      aria-label={label}
      className="relative block w-full cursor-zoom-in overflow-hidden text-left"
    >
      {children}
    </button>
  );
}
