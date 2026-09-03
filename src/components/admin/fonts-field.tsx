"use client";

import { useRef, useState } from "react";
import { addSiteFont, deleteSiteFont } from "@/app/admin/settings-actions";
import { uploadSiteFile } from "@/lib/client-upload";
import { type FontFormat, type UploadedFont } from "@/lib/fonts";
import { ConfirmDialog } from "./confirm-dialog";
import { restoreDeleted } from "@/app/admin/undo-actions";
import type { Backup } from "@/lib/undo-backup";
import { useAction } from "./use-action";
import { useUndo } from "./undo-provider";
import { SECONDARY_BUTTON } from "./styles";

const MAX_FONTS = 12;

/**
 * What removing a font actually costs.
 *
 * The dialog is the only place she can discover that the font she is deleting
 * is currently setting her whole site, so it says which built-in each role
 * falls back to — and they differ: body text goes to Inter, headings to
 * Fraunces, so a deleted heading face does not flatten the page into one face.
 */
function removalWarning(font: UploadedFont, bodyFontId: string, headingFontId: string): string {
  const roles: string[] = [];
  if (font.id === headingFontId) roles.push("headings, which go back to Fraunces");
  if (font.id === bodyFontId) roles.push("body text, which goes back to Inter");

  const inUse =
    roles.length > 0 ? ` It is currently your site’s ${roles.join(" and your site’s ")}.` : "";

  return `“${font.label}” will no longer be offered.${inUse} Any text already using it goes back to Inter — nothing is lost, and uploading it again brings it back.`;
}

/**
 * Fonts the artist has uploaded, offered alongside the built-in faces when she
 * formats a text box on the wall.
 *
 * Deleting one leaves the text boxes using it alone: they keep the key they
 * were given and fall back to Inter, which is the case that fallback exists
 * for. Nothing has to be swept, and re-uploading the same face is not undone
 * by a migration.
 */
export function FontsField({
  fonts,
  bodyFontId,
  headingFontId,
}: {
  fonts: UploadedFont[];
  /** The site's current faces, so the remove dialog can name the consequence. */
  bodyFontId: string;
  headingFontId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, track, pending, error } = useAction();
  const { record } = useUndo();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<UploadedFont | null>(null);

  const full = fonts.length >= MAX_FONTS;

  async function upload(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadSiteFile(file, "font");
      const id = await addSiteFont({
        label: file.name.replace(/\.\w+$/, ""),
        storageKey: uploaded.key,
        format: uploaded.format as FontFormat,
      });

      /*
        Undo removes the font; redo puts back the row that removal returned.
        A text box that had chosen this face keeps its id through the whole
        cycle — `resolveFontFamily` falls back to Inter while the row is gone
        and finds the face again when it returns.
      */
      let removed: Backup | null = null;
      record({
        label: "adding the font",
        undo: async () => {
          removed = await track(deleteSiteFont(id), "Undoing the font");
        },
        redo: async () => {
          if (removed !== null) await track(restoreDeleted(removed), "Redoing the font");
        },
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {fonts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {fonts.map((font) => (
            <li
              key={font.id}
              className="border-line bg-paper flex items-center justify-between gap-4 border px-3 py-2"
            >
              <span className="text-sm" style={{ fontFamily: `"${font.family}", sans-serif` }}>
                {font.label}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(font)}
                className="text-graphite shrink-0 text-xs underline underline-offset-4 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || pending || full}
          onClick={() => inputRef.current?.click()}
          className={SECONDARY_BUTTON}
        >
          Upload a font
        </button>
        <span className="text-graphite text-xs" aria-live="polite">
          {busy ? "Uploading…" : pending ? "Saving…" : ""}
        </span>
      </div>

      <p className="text-graphite max-w-prose text-xs">
        {full
          ? `That is ${MAX_FONTS} fonts, which is the limit. Remove one to add another.`
          : "A .woff2, .woff, .ttf or .otf file, up to 2MB. Uploaded fonts appear in the list when you format a text box on your home page. .woff2 is the smallest and loads fastest."}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(upload(file), "Uploading the font");
        }}
      />

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Remove this font?"
        body={confirming ? removalWarning(confirming, bodyFontId, headingFontId) : ""}
        confirmLabel="Remove"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) {
            const removal = deleteSiteFont(confirming.id);
            record({
              label: "removing the font",
              undo: () => track(removal.then(restoreDeleted), "Undoing the removal"),
              redo: () =>
                track(
                  deleteSiteFont(confirming.id).then(() => undefined),
                  "Redoing the removal",
                ),
            });
            run(removal, "Removing the font");
          }
          setConfirming(null);
        }}
      />
    </div>
  );
}
