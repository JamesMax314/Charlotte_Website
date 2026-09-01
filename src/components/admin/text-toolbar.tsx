"use client";

import { useState } from "react";
import { WALL_TEXT_CQW, cqwToPt, ptToCqw, type TextAlign, type WallText } from "@/lib/portfolio";
import { DEFAULT_ACCENT, INK, PAPER } from "@/lib/colour";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";

type Patch = Partial<
  Pick<WallText, "fontSize" | "align" | "bold" | "italic" | "underline" | "colour" | "font">
>;

const BUTTON =
  "border-line hover:border-ink flex h-8 min-w-8 items-center justify-center border px-2 text-sm transition-colors";
const ACTIVE = "bg-ink text-paper border-ink";

const ALIGNMENTS: { value: TextAlign; label: string; glyph: string }[] = [
  { value: "left", label: "Align left", glyph: "◧" },
  { value: "center", label: "Align centre", glyph: "▣" },
  { value: "right", label: "Align right", glyph: "◨" },
];

/**
 * A few sensible starting points; any hex can still be typed.
 *
 * Taken from the tokens rather than copied as literals, so they cannot drift
 * from the palette. The accent is the shipped default rather than the artist's
 * current highlight: a swatch that moved when she changed her highlight would
 * silently restyle nothing, since a text colour is stored per box.
 */
const SWATCHES = [INK, "#6d6a66", DEFAULT_ACCENT, PAPER, "#2140d6"];

function ColourControl({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit(hex: string) {
    setDraft(hex);
    // Only push a complete, valid hex — otherwise the colour would flicker as
    // the artist types the first character.
    if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Text colour, currently ${value}`}
        className={`${BUTTON} gap-2`}
      >
        <span
          className="border-line block h-4 w-4 border"
          style={{ background: value }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs">{value}</span>
      </button>

      {open && (
        <div className="border-line bg-paper absolute top-9 left-0 z-50 flex w-52 flex-col gap-3 border p-3 shadow-lg">
          <label className="text-graphite text-xs">
            Hex
            <input
              value={draft}
              onChange={(e) => commit(e.target.value)}
              spellCheck={false}
              className="border-line focus:border-ink mt-1 w-full border bg-transparent px-2 py-1 font-mono text-xs outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                onClick={() => commit(hex)}
                className="border-line h-6 w-6 border"
                style={{ background: hex }}
              />
            ))}
          </div>

          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : value}
            onChange={(e) => commit(e.target.value)}
            className="h-8 w-full cursor-pointer bg-transparent"
            aria-label="Pick a colour"
          />

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-graphite self-start text-xs underline underline-offset-2"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export function TextToolbar({
  text,
  onChange,
  onDelete,
  fonts = BUILT_IN_FONTS,
}: {
  text: WallText;
  onChange: (patch: Patch) => void;
  onDelete: () => void;
  /**
   * Injected rather than imported, so the admin can pass built-in plus
   * uploaded fonts later without this component changing.
   */
  fonts?: FontOption[];
}) {
  /*
    Held while she types, so a half-typed number is not immediately committed.
    Without it, typing "12" commits "1" first — which is below the minimum, so
    it clamps to 5 and the next keystroke lands on "52".
  */
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const minPt = Math.ceil(cqwToPt(WALL_TEXT_CQW.min));
  const maxPt = Math.floor(cqwToPt(WALL_TEXT_CQW.max));

  return (
    <div className="flex w-72 flex-wrap items-center gap-2 p-2">
      <label className="text-graphite flex w-full items-center gap-1.5 text-xs">
        Font
        <select
          value={text.font}
          onChange={(e) => onChange({ font: e.target.value })}
          // Native rather than a custom dropdown: reliable on a tablet, and it
          // needs no dismissal handling inside an already-floating panel.
          className="border-line focus:border-ink min-w-0 flex-1 border bg-transparent px-2 py-1 text-xs outline-none"
          style={{ fontFamily: fonts.find((f) => f.id === text.font)?.family }}
        >
          {fonts.map((font) => (
            // Previewed in its own face, so the artist sees what she is picking.
            <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-graphite flex items-center gap-1.5 text-xs">
        Size
        {/*
          Points, never the stored `cqw`. The wall has to size type as a
          percentage of its own width or type would stop scaling with it, but
          "2.4" means nothing to anyone — so the unit is converted at the edge
          and the storage is left alone. See cqwToPt for what the number is
          exact against.
        */}
        <span className="relative inline-flex items-center">
          <input
            type="number"
            min={minPt}
            max={maxPt}
            step={1}
            value={sizeDraft ?? Math.round(cqwToPt(text.fontSize))}
            onChange={(e) => {
              setSizeDraft(e.target.value);
              const pt = Number(e.target.value);
              // Commit only what is in range; a cleared field reads as 0, and
              // committing that would collapse her text to nothing mid-edit.
              if (Number.isFinite(pt) && pt >= minPt && pt <= maxPt) {
                onChange({ fontSize: ptToCqw(pt) });
              }
            }}
            // Snaps back to what was actually stored, so an abandoned or
            // out-of-range entry never lingers in the field as if it took.
            onBlur={() => setSizeDraft(null)}
            className="border-line focus:border-ink w-20 border bg-transparent py-1 pr-7 pl-2 text-xs outline-none"
          />
          <span aria-hidden className="text-graphite/70 pointer-events-none absolute right-2">
            pt
          </span>
        </span>
      </label>

      <span className="bg-line mx-1 h-6 w-px" aria-hidden="true" />

      <div className="flex gap-1" role="group" aria-label="Alignment">
        {ALIGNMENTS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={text.align === option.value}
            onClick={() => onChange({ align: option.value })}
            className={`${BUTTON} ${text.align === option.value ? ACTIVE : ""}`}
          >
            {option.glyph}
          </button>
        ))}
      </div>

      <span className="bg-line mx-1 h-6 w-px" aria-hidden="true" />

      <button
        type="button"
        aria-label="Bold"
        aria-pressed={text.bold}
        onClick={() => onChange({ bold: !text.bold })}
        className={`${BUTTON} font-bold ${text.bold ? ACTIVE : ""}`}
      >
        B
      </button>
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={text.italic}
        onClick={() => onChange({ italic: !text.italic })}
        className={`${BUTTON} italic ${text.italic ? ACTIVE : ""}`}
      >
        I
      </button>
      <button
        type="button"
        aria-label="Underline"
        aria-pressed={text.underline}
        onClick={() => onChange({ underline: !text.underline })}
        className={`${BUTTON} underline ${text.underline ? ACTIVE : ""}`}
      >
        U
      </button>

      <span className="bg-line mx-1 h-6 w-px" aria-hidden="true" />

      <ColourControl value={text.colour} onChange={(colour) => onChange({ colour })} />

      <button
        type="button"
        onClick={onDelete}
        className="text-graphite mt-1 w-full px-1 text-left text-xs underline underline-offset-2 hover:text-red-700"
      >
        Delete text
      </button>
    </div>
  );
}
