"use client";

import { WIDTH_LADDER } from "@/image-loader";

/**
 * Browser-side image preparation and upload.
 *
 * Extracted so the image manager and the wall's add-image dialog share one
 * pipeline. A second copy would drift from the width ladder in
 * src/image-loader.ts, and every image addressed by the missing derivative
 * would silently fall back to the full-size master.
 */

const MAX_EDGE = WIDTH_LADDER[WIDTH_LADDER.length - 1];

function render(bitmap: ImageBitmap, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Downscales in the browser and writes the whole responsive ladder.
 *
 * Two reasons this happens client-side: the artist uploads from a phone, where
 * a 60MB camera file over mobile data stalls; and Workers has no image
 * optimizer, so the derivatives have to exist as real objects. Also grabs the
 * blur placeholder while the bitmap is already decoded.
 */
export async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const master = await render(bitmap, width, height, 0.86);

  // Never upscale: a 900px original gets no 1600px derivative.
  const variants = new Map<number, Blob>();
  for (const target of WIDTH_LADDER) {
    if (target >= width) continue;
    const variant = await render(bitmap, target, Math.round((target * height) / width), 0.82);
    if (variant) variants.set(target, variant);
  }

  const tiny = document.createElement("canvas");
  tiny.width = 16;
  tiny.height = Math.max(1, Math.round((16 * height) / width));
  tiny.getContext("2d")?.drawImage(bitmap, 0, 0, tiny.width, tiny.height);
  bitmap.close();

  return { master, variants, width, height, lqip: tiny.toDataURL("image/jpeg", 0.4) };
}

export interface UploadedImage {
  id: string;
  src: string;
  width: number;
  height: number;
}

/** Prepares and uploads one file, returning the stored image. */
export async function uploadImage(
  file: File,
  target: { field: "artworkId" | "portfolioItemId"; parentId: string; alt?: string },
): Promise<UploadedImage> {
  const { master, variants, width, height, lqip } = await prepareImage(file);
  if (!master) throw new Error("Could not read that image.");

  const name = file.name.replace(/\.\w+$/, ".jpg");
  const body = new FormData();
  body.set("file", new File([master], name, { type: "image/jpeg" }));
  body.set(target.field, target.parentId);
  body.set("width", String(width));
  body.set("height", String(height));
  body.set("lqip", lqip);
  if (target.alt) body.set("alt", target.alt);
  for (const [size, blob] of variants) {
    body.set(`variant-${size}`, new File([blob], name, { type: "image/jpeg" }));
  }

  const response = await fetch("/api/admin/upload", { method: "POST", body });
  const result = (await response.json()) as { id?: string; src?: string; error?: string };
  if (!response.ok || !result.id || !result.src) {
    throw new Error(result.error ?? "Upload failed.");
  }

  return { id: result.id, src: result.src, width, height };
}
