"use client";

import { useState, useTransition } from "react";
import { updatePageSettings } from "@/app/admin/portfolio-actions";

export interface PageSettings {
  gutterEnabled: boolean;
  gutter: number;
  snapEnabled: boolean;
  showNamesOnHover: boolean;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent mt-0.5 size-4 shrink-0"
      />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="text-graphite block text-xs">{hint}</span>
      </span>
    </label>
  );
}

/**
 * How the wall behaves.
 *
 * Changes save on the spot rather than behind a Save button: these are
 * switches the artist flips while looking at the wall, and a pending change
 * she forgot to save would make the canvas lie about what visitors see.
 */
export function PageSettingsPanel({ settings }: { settings: PageSettings }) {
  const [value, setValue] = useState(settings);
  const [pending, startTransition] = useTransition();

  function apply(patch: Partial<PageSettings>) {
    const next = { ...value, ...patch };
    setValue(next);
    startTransition(() => {
      void updatePageSettings(patch);
    });
  }

  return (
    <section className="border-line bg-paper-sunk/40 mb-10 border p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg tracking-tight">Page settings</h2>
        <span className="text-graphite h-4 text-xs" aria-live="polite">
          {pending ? "Saving…" : ""}
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Toggle
            label="Keep a gap between pieces"
            hint="Pieces snap to sit a set distance apart instead of touching."
            checked={value.gutterEnabled}
            onChange={(gutterEnabled) => apply({ gutterEnabled })}
          />
          <label
            className={`text-graphite flex items-center gap-2 pl-7 text-xs transition-opacity ${
              value.gutterEnabled ? "opacity-100" : "opacity-40"
            }`}
          >
            Gap
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={value.gutter}
              disabled={!value.gutterEnabled}
              onChange={(e) => apply({ gutter: Number(e.target.value) })}
              className="border-line focus:border-ink w-16 border bg-transparent px-2 py-1 text-xs outline-none disabled:cursor-not-allowed"
            />
            % of width
          </label>
        </div>

        <Toggle
          label="Snap to align"
          hint="Edges line up with neighbouring pieces as you drag. Hold Alt to override."
          checked={value.snapEnabled}
          onChange={(snapEnabled) => apply({ snapEnabled })}
        />

        <Toggle
          label="Show names on hover"
          hint="Visitors see the piece's name over the image when they point at it."
          checked={value.showNamesOnHover}
          onChange={(showNamesOnHover) => apply({ showNamesOnHover })}
        />
      </div>
    </section>
  );
}
