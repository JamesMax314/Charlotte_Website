"use client";

/**
 * Browser-side image upload.
 *
 * Extracted so the image manager and the wall's add-image dialog share one
 * path. What it used to do — draw the file into a canvas once per rung of the
 * width ladder, encode each as JPEG, and post four files — now happens on the
 * server, through Cloudflare's image service. See `src/lib/image-ladder.ts`
 * for why: a canvas cannot encode AVIF at all, its downscaling aliases fine
 * detail, and sending four encodes of one photograph up the artist's
 * connection was three more than the job needed.
 *
 * What is left here is transport, and only transport. The browser's job is to
 * get the bytes to the Worker; every pixel that is ever served is decided
 * server-side, from the original.
 */

/**
 * Past this, the file is downscaled before it is sent.
 *
 * Not an optimisation — a guard. Cameras produce 60MB files and the upload
 * route refuses anything over its own limit, so without this the artist would
 * be told her photograph was "too large" with nothing to do about it. Below
 * the threshold the original bytes go up untouched, which is what gives the
 * server the best possible input to work from.
 */
const SEND_UNTOUCHED_BELOW_BYTES = 10 * 1024 * 1024;

/**
 * And the size it is reduced to when it does have to be reduced.
 *
 * Comfortably above the widest rung (2400), so the ladder is still built from
 * more detail than any of its rungs needs. Quality is high for the same
 * reason: this file is an intermediate, not something anyone will ever see, so
 * the usual reasons to compress it do not apply.
 */
const OVERSIZE_EDGE = 3200;
const OVERSIZE_QUALITY = 0.92;

/** Natural size, and the bytes to send. */
interface Prepared {
  file: File;
  width: number;
  height: number;
}

/**
 * The file as it should be sent, with its natural size.
 *
 * `createImageBitmap` is used only to measure and — for an oversized file — to
 * resize. The dimensions travel with the upload because the server can read
 * them too but the *client* needs them either way, to lay the piece out on the
 * wall the moment it lands.
 */
async function prepare(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (file.size <= SEND_UNTOUCHED_BELOW_BYTES && Math.max(width, height) <= OVERSIZE_EDGE) {
    bitmap.close();
    return { file, width, height };
  }

  const scale = Math.min(1, OVERSIZE_EDGE / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", OVERSIZE_QUALITY),
  );
  if (!blob) throw new Error("Could not read that image.");

  return {
    file: new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }),
    width: targetWidth,
    height: targetHeight,
  };
}

export interface UploadedImage {
  id: string;
  src: string;
  width: number;
  height: number;
}

/** Sends one file and returns the stored image. */
export async function uploadImage(
  file: File,
  target: { field: "artworkId" | "portfolioItemId"; parentId: string; alt?: string },
): Promise<UploadedImage> {
  const prepared = await prepare(file);

  const body = new FormData();
  body.set("file", prepared.file);
  body.set(target.field, target.parentId);
  body.set("width", String(prepared.width));
  body.set("height", String(prepared.height));
  if (target.alt) body.set("alt", target.alt);

  const response = await fetch("/api/admin/upload", { method: "POST", body });
  const result = (await response.json()) as {
    id?: string;
    src?: string;
    width?: number;
    height?: number;
    error?: string;
  };
  if (!response.ok || !result.id || !result.src) {
    throw new Error(result.error ?? "Upload failed.");
  }

  // The server's measurement wins where it has one: it reads the file's own
  // header, while the client's came from a decode the browser may have
  // orientation-corrected.
  return {
    id: result.id,
    src: result.src,
    width: result.width ?? prepared.width,
    height: result.height ?? prepared.height,
  };
}

// ---------------------------------------------------------------- site assets

export interface UploadedAsset {
  key: string;
  src: string;
}

const postAsset = async (body: FormData): Promise<Record<string, unknown>> => {
  const response = await fetch("/api/admin/upload/asset", { method: "POST", body });
  const result = (await response.json()) as Record<string, unknown> & { error?: string };
  if (!response.ok || typeof result.key !== "string") {
    throw new Error(result.error ?? "Upload failed.");
  }
  return result;
};

/**
 * The About photograph: laddered and blurred like any other photograph, and
 * through the same server-side pipeline.
 *
 * It renders at roughly a third of a wide viewport and needs a srcset and a
 * placeholder, which is the whole reason it does not take the favicon's
 * store-as-uploaded path.
 */
export async function uploadSiteImage(
  file: File,
): Promise<UploadedAsset & { width: number; height: number; lqip: string }> {
  const prepared = await prepare(file);

  const body = new FormData();
  body.set("kind", "aboutPhoto");
  body.set("file", prepared.file);
  body.set("width", String(prepared.width));
  body.set("height", String(prepared.height));

  const result = await postAsset(body);
  return {
    key: result.key as string,
    src: result.src as string,
    width: typeof result.width === "number" ? result.width : prepared.width,
    height: typeof result.height === "number" ? result.height : prepared.height,
    lqip: typeof result.lqip === "string" ? result.lqip : "",
  };
}

/**
 * A file uploaded as-is: the mark, or a font.
 *
 * Deliberately does not touch `prepare`. `createImageBitmap` is undefined for
 * a font file, and a re-encode would strip the transparency a mark depends on.
 */
export async function uploadSiteFile(
  file: File,
  kind: "favicon" | "font",
): Promise<UploadedAsset & { format?: string }> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);

  const result = await postAsset(body);
  return {
    key: result.key as string,
    src: result.src as string,
    ...(typeof result.format === "string" ? { format: result.format } : {}),
  };
}
