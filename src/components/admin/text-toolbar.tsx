"use client";

import { useState } from "react";
import type { TextAlign, WallText } from "@/lib/portfolio";
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

/** A few sensible starting points; any hex can still be typed. */
const SWATCHES = ["#101010", "#6d6a66", "#9a5b33", "#fbfbf9", "#2140d6"];

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
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.1}
          value={text.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="border-line focus:border-ink w-16 border bg-transparent px-2 py-1 text-xs outline-none"
        />
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
