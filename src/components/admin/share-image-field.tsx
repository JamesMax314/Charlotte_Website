"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { setShareImage } from "@/app/admin/settings-actions";
import { uploadSiteImage } from "@/lib/client-upload";
import { useAction } from "./use-action";
import { SECONDARY_BUTTON } from "./styles";

/**
 * The picture shown when someone shares a link to the site.
 *
 * Goes through the same pipeline as the About photograph, which is what makes
 * it a JPEG: the client re-encodes before upload, and JPEG is the one format
 * every link preview reliably fetches. A page with artwork of its own uses that
 * instead — this is the card for the pages that have none.
 */
export function ShareImageField({
  imageKey,
  width,
  height,
}: {
  imageKey: string | null;
  width: number | null;
  height: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useAction();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadSiteImage(file);
      await setShareImage({ key: uploaded.key, width: uploaded.width, height: uploaded.height });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      {imageKey && width && height && (
        <Image
          src={`/media/${imageKey}`}
          alt=""
          width={width}
          height={height}
          sizes="192px"
          className="border-line h-auto w-48 shrink-0 border"
        />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || pending}
            onClick={() => inputRef.current?.click()}
            className={SECONDARY_BUTTON}
          >
            {imageKey ? "Replace picture" : "Upload a picture"}
          </button>

          {imageKey && (
            <button
              type="button"
              disabled={busy || pending}
              onClick={() => run(setShareImage(null), "Removing the picture")}
              className="text-graphite px-2 py-2 text-sm underline underline-offset-4 hover:text-red-700"
            >
              Remove
            </button>
          )}

          <span className="text-graphite text-xs" aria-live="polite">
            {busy ? "Uploading…" : pending ? "Saving…" : ""}
          </span>
        </div>

        <p className="text-graphite max-w-prose text-xs">
          Used when your site is shared on Instagram, WhatsApp or a message. A wide picture works
          best — around 1200 by 630. Without one your mark is used, which appears smaller and
          square.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(upload(file), "Uploading the picture");
        }}
      />

      {error && (
        <p role="alert" className="basis-full text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
