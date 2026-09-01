"use client";

import { useState } from "react";
import { setAccentColour } from "@/app/admin/settings-actions";
import { ACCENT_SUGGESTIONS, DEFAULT_ACCENT, judgeAccent, normaliseHex } from "@/lib/colour";
import { useAction } from "./use-action";
import { FIELD } from "./styles";

const WARNING: Record<"ok" | "faint" | "invisible", string | null> = {
  ok: null,
  faint:
    "This colour is faint against the paper background, so links and the focus outline will be hard to see. Buttons will still read.",
  invisible:
    "This colour nearly disappears against the paper background, so links and the focus outline will be very hard to see. Buttons will still read.",
};

/**
 * The one colour the artist controls.
 *
 * Saves as she leaves the picker rather than behind the section's Save button:
 * the whole admin repaints with it, which makes it a switch with a live
 * surface — the same case as the wall's page settings. It cannot save on every
 * change, because `input type="color"` fires continuously while the picker is
 * dragged. A suggestion is a discrete choice rather than a drag, so those
 * commit on the click.
 *
 * The verdict warns; it never blocks. A pale highlight used mainly as a button
 * surface is a legitimate choice, and the button's foreground is derived so it
 * stays readable either way. What cannot be derived is how the colour reads as
 * link text and as the focus ring, which is what this says out loud.
 */
export function AccentField({ accentColour }: { accentColour: string }) {
  const [value, setValue] = useState(accentColour);
  const { run, pending, error } = useAction();

  const hex = normaliseHex(value) ?? DEFAULT_ACCENT;
  const verdict = judgeAccent(hex);
  const warning = WARNING[verdict.level];

  const commit = (next: string) => {
    const safe = normaliseHex(next);
    if (safe && safe !== normaliseHex(accentColour)) {
      run(setAccentColour(safe), "Saving the highlight colour");
    }
  };

  return (
    <div
      // Previews the choice locally before it is saved, and once saved the
      // root layout emits the same two properties for the whole document.
      style={{ ["--accent" as string]: hex, ["--accent-ink" as string]: verdict.ink }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-graphite text-xs">Suggestions</span>
        <div className="flex flex-wrap gap-2">
          {ACCENT_SUGGESTIONS.map((swatch) => {
            const selected = swatch.hex === hex;
            return (
              <button
                key={swatch.hex}
                type="button"
                title={swatch.name}
                aria-label={swatch.name}
                aria-pressed={selected}
                onClick={() => {
                  setValue(swatch.hex);
                  commit(swatch.hex);
                }}
                style={{ background: swatch.hex }}
                className={`h-7 w-7 border transition-transform hover:scale-110 ${
                  selected ? "border-ink ring-line ring-2" : "border-line"
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-graphite text-xs">Colour</span>
          <input
            type="color"
            value={hex}
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            className="border-line h-11 w-16 cursor-pointer border bg-transparent p-1"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-graphite text-xs">Hex</span>
          <input
            type="text"
            value={value}
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            className={`${FIELD} w-32 font-mono`}
          />
        </label>

        <div className="flex items-center gap-3">
          <span className="bg-accent text-accent-ink px-5 py-3 text-sm">Buy on Etsy — £45</span>
          <span className="text-accent text-sm">A link</span>
        </div>

        <span className="text-graphite pb-3 text-xs" aria-live="polite">
          {pending ? "Saving…" : ""}
        </span>
      </div>

      {warning && (
        <p className="text-graphite max-w-prose text-xs">
          <span aria-hidden="true">⚠ </span>
          {warning}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
