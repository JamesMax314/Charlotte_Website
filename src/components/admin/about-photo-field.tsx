"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { setAboutPhoto, type AboutPhoto } from "@/app/admin/settings-actions";
import { uploadSiteImage } from "@/lib/client-upload";
import { useAction } from "./use-action";
import { useUndo } from "./undo-provider";
import { SECONDARY_BUTTON } from "./styles";

/**
 * The photograph shown to the left of the About copy.
 *
 * Goes through the full width ladder, unlike the mark: it renders at roughly a
 * third of a wide viewport and needs a srcset and a blur placeholder like any
 * other photograph on the site.
 */
export function AboutPhotoField({
  photoKey,
  width,
  height,
  lqip,
  alt,
}: {
  photoKey: string | null;
  width: number | null;
  height: number | null;
  /*
    Neither is drawn here — the thumbnail is 128px wide and needs no
    placeholder, and the description is edited in the field beside this one.
    Both are here so undo can put the whole photograph back: setting one clears
    the description by design, so restoring the picture alone would lose the
    words the artist wrote about it.
  */
  lqip: string | null;
  alt: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, track, pending, error } = useAction();
  const { record } = useUndo();

  /** The photograph as it stands, in the shape the setter takes. */
  const current = (): AboutPhoto | null =>
    photoKey === null || width === null || height === null
      ? null
      : { key: photoKey, width, height, lqip: lqip ?? "", alt };

  const swap = (before: AboutPhoto | null, after: AboutPhoto | null) => {
    record({
      label: "the photograph",
      undo: () => track(setAboutPhoto(before), "Undoing the photograph"),
      redo: () => track(setAboutPhoto(after), "Redoing the photograph"),
    });
  };
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadSiteImage(file);
      const before = current();
      const after = {
        key: uploaded.key,
        width: uploaded.width,
        height: uploaded.height,
        lqip: uploaded.lqip,
      };
      await setAboutPhoto(after);
      swap(before, after);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      {photoKey && width && height && (
        <Image
          src={`/media/${photoKey}`}
          alt=""
          width={width}
          height={height}
          sizes="128px"
          className="border-line h-auto w-32 shrink-0 border"
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
            {photoKey ? "Replace photograph" : "Upload a photograph"}
          </button>

          {photoKey && (
            <button
              type="button"
              disabled={busy || pending}
              onClick={() => {
                swap(current(), null);
                run(setAboutPhoto(null), "Removing the photograph");
              }}
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
          Shown beside your About text — to the left of it on a wide screen, above it on a phone.
          Without one, the drawn mark is used instead.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(upload(file), "Uploading the photograph");
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
