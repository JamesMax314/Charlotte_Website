"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { setFavicon } from "@/app/admin/settings-actions";
import { uploadSiteFile } from "@/lib/client-upload";
import { Mark } from "@/components/mark";
import { useAction } from "./use-action";
import { SECONDARY_BUTTON } from "./styles";

/**
 * The mark, shown in the site header and in the browser tab.
 *
 * Uploads persist immediately rather than waiting behind the section's Save
 * button: the upload is itself the deliberate act, and deferring the settings
 * write is how a bucket fills with objects nothing references.
 */
export function FaviconField({ faviconKey }: { faviconKey: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, pending, error } = useAction();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setNote(null);
    try {
      // A mark that is not square is cropped by the circle, which is usually
      // what she wants — so this is said, not enforced.
      const bitmap = await createImageBitmap(file);
      const lopsided = Math.abs(bitmap.width - bitmap.height) / Math.max(bitmap.width, 1) > 0.1;
      bitmap.close();
      if (lopsided) setNote("That image is not square, so the circle will crop its edges.");

      const uploaded = await uploadSiteFile(file, "favicon");
      await setFavicon(uploaded.key);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <span className="border-line bg-paper flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border">
        {faviconKey ? (
          <Image
            src={`/media/${faviconKey}`}
            alt=""
            width={128}
            height={128}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <Mark className="text-ink h-9 w-9" />
        )}
      </span>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || pending}
            onClick={() => inputRef.current?.click()}
            className={SECONDARY_BUTTON}
          >
            {faviconKey ? "Replace mark" : "Upload a mark"}
          </button>

          {faviconKey && (
            <button
              type="button"
              disabled={busy || pending}
              onClick={() => run(setFavicon(null), "Removing the mark")}
              className="text-graphite px-2 py-2 text-sm underline underline-offset-4 hover:text-red-700"
            >
              Remove
            </button>
          )}

          <span className="text-graphite text-xs" aria-live="polite">
            {busy ? "Uploading…" : pending ? "Saving…" : ""}
          </span>
        </div>

        <p className="text-graphite text-xs">
          A square PNG or WebP, up to 512KB. It is shown in a circle beside your name and in the
          browser tab. Leave it empty to use the drawn mark.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(upload(file), "Uploading the mark");
        }}
      />

      {note && (
        <p className="text-graphite basis-full text-xs">{note}</p>
      )}
      {error && (
        <p role="alert" className="basis-full text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
