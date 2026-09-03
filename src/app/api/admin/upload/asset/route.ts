import { getCloudflareContext } from "@opennextjs/cloudflare";
import { claimMedia } from "@/lib/publish";
import { hasValidSession } from "@/lib/auth";
import { extensionForFormat, fontFormatFor, type FontFormat } from "@/lib/fonts";
import { assetKey, contentHash, IMAGE_EXTENSIONS } from "@/lib/storage";
import { measure, renderLqip, writeLadder } from "@/lib/image-ladder";

export const dynamic = "force-dynamic";

/**
 * Uploads that belong to the site rather than to a piece of work.
 *
 * A separate route from /api/admin/upload on purpose. That one resolves an
 * owning artwork or portfolio item, defaults alt text from its title, computes
 * a sort order against its siblings and inserts an image row — none of which
 * an ownerless upload has. Threading a third destination through it would mean
 * five conditionals to avoid one file, so this reuses the primitives instead.
 *
 * It writes no database row: it returns a descriptor, and a server action
 * persists it. Only the action knows what is being replaced, which is where
 * the cleanup of the old object has to live.
 */

const KINDS = ["favicon", "aboutPhoto", "font"] as const;
type Kind = (typeof KINDS)[number];

const isKind = (value: string): value is Kind => (KINDS as readonly string[]).includes(value);

/*
  A favicon is stored as uploaded, never through the width ladder.

  The client pipeline re-encodes to JPEG, which destroys the alpha channel a
  mark needs, and scales up to 2400px on the long edge — not something to put
  in a <link rel="icon">.

  SVG is excluded deliberately: /media serves same-origin with the object's own
  content-type, so an SVG containing a script would execute in the site's
  origin when loaded at its URL. PNG and WebP cover the need.
*/
const FAVICON_TYPES = new Set(["image/png", "image/webp"]);
const PHOTO_TYPES = new Set(Object.keys(IMAGE_EXTENSIONS));

const LIMITS: Record<Kind, number> = {
  favicon: 512 * 1024,
  aboutPhoto: 12 * 1024 * 1024,
  font: 2 * 1024 * 1024,
};

const PREFIX: Record<Kind, string> = {
  favicon: "site",
  aboutPhoto: "site",
  font: "fonts",
};

export async function POST(request: Request) {
  // Route handlers bypass layouts, so this gates itself.
  if (!(await hasValidSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  if (!isKind(kind)) {
    return Response.json({ error: "No destination given." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > LIMITS[kind]) {
    return Response.json({ error: "That file is too large." }, { status: 413 });
  }

  let extension: string;
  let contentType: string;
  let format: FontFormat | undefined;

  if (kind === "font") {
    /*
      Fonts are gated on the extension, not file.type. Browsers report a font
      upload as font/woff2, application/font-woff2, application/octet-stream or
      "" depending on the operating system and the browser, so the mime type
      the image paths can trust is worthless here.
    */
    format = fontFormatFor(file.name) ?? undefined;
    if (!format) {
      return Response.json(
        { error: "That is not a font file. Use .woff2, .woff, .ttf or .otf." },
        { status: 415 },
      );
    }
    extension = extensionForFormat(format);
    contentType = `font/${extension}`;
  } else {
    const allowed = kind === "favicon" ? FAVICON_TYPES : PHOTO_TYPES;
    if (!allowed.has(file.type)) {
      return Response.json(
        {
          error:
            kind === "favicon"
              ? "A mark must be a PNG or WebP, so it can keep its transparency."
              : `Unsupported image type ${file.type}.`,
        },
        { status: 415 },
      );
    }
    extension = IMAGE_EXTENSIONS[file.type];
    contentType = file.type;
  }

  const bytes = await file.arrayBuffer();
  const storageKey = assetKey(PREFIX[kind], await contentHash(bytes), extension);

  const { env, ctx } = await getCloudflareContext({ async: true });
  await env.MEDIA.put(storageKey, bytes, { httpMetadata: { contentType } });

  // As in the image upload: an identical file yields an identical key, which
  // may be one a delete had queued. See claimMedia.
  await claimMedia([storageKey]);

  /*
    The About photo carries a ladder and a blur placeholder; the other two
    deliberately do not. A font is not an image, and a mark is stored exactly
    as uploaded — re-encoding it would cost the transparency it depends on,
    which is the invariant behind its `unoptimized` rendering.

    Same shape as the image upload: what the caller's *row* needs is awaited,
    and the eight encodings that only /media reads follow behind the response.
  */
  if (kind !== "aboutPhoto") {
    return Response.json({
      key: storageKey,
      src: `/media/${storageKey}`,
      ...(format ? { format } : {}),
    });
  }

  const measured = await measure(bytes);
  const width = measured?.width ?? Number(form.get("width")) ?? 0;
  const height = measured?.height ?? Number(form.get("height")) ?? 0;
  const lqip = await renderLqip(bytes);

  ctx.waitUntil(writeLadder(storageKey, bytes, width));

  return Response.json({
    key: storageKey,
    src: `/media/${storageKey}`,
    width,
    height,
    ...(lqip === null ? {} : { lqip }),
  });
}
