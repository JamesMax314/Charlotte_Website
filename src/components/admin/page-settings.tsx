"use client";

import { useState } from "react";
import { updatePageSettings } from "@/app/admin/portfolio-actions";
import { GRID_COLUMN_CHOICES } from "@/lib/grid";
import { ScrollSelect } from "./size-select";
import { useAction } from "./use-action";
import { useUndo } from "./undo-provider";

/** The gap between pieces, as a percentage of the wall's width. */
const GAP_CHOICES = [0.5, 1, 2, 3, 4, 5, 10, 15, 20];

export interface PageSettings {
  gutterEnabled: boolean;
  gutter: number;
  snapEnabled: boolean;
  gridEnabled: boolean;
  gridColumns: number;
  gridSnap: boolean;
  showNamesOnHover: boolean;
  contentFadeIn: boolean;
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
  const { run, track, pending, error } = useAction();
  const { record } = useUndo();

  /** Applies a patch to the panel and returns the write. */
  const write = (patch: Partial<PageSettings>) => {
    setValue((current) => ({ ...current, ...patch }));
    return updatePageSettings(patch);
  };

  function apply(patch: Partial<PageSettings>) {
    /*
      The inverse is the same keys with the values they had. Built from the
      patch rather than from the whole settings object, so undoing one switch
      writes one column — a whole-object restore would silently revert
      anything else that changed in between.
    */
    const before = Object.fromEntries(
      Object.keys(patch).map((key) => [key, value[key as keyof PageSettings]]),
    ) as Partial<PageSettings>;

    record({
      label: "the page setting",
      undo: () => track(write(before), "Undoing the page setting"),
      redo: () => track(write(patch), "Redoing the page setting"),
    });

    run(write(patch), "Saving the page settings");
  }

  return (
    <section className="border-line bg-paper-sunk/40 mb-10 border p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg tracking-tight">Page settings</h2>
        <span className="text-graphite h-4 text-xs" aria-live="polite">
          {pending ? "Saving…" : ""}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <ScrollSelect
              value={value.gutter}
              options={
                GAP_CHOICES.includes(value.gutter)
                  ? GAP_CHOICES
                  : [...GAP_CHOICES, value.gutter].sort((a, b) => a - b)
              }
              onChange={(gutter) => apply({ gutter })}
              disabled={!value.gutterEnabled}
              label="Gap between pieces"
              format={(v) => `${v}%`}
              className="w-20"
            />
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

        <div className="flex flex-col gap-2">
          <Toggle
            label="Show a grid"
            hint="Fine guide lines over the wall while you arrange it. Never seen by a visitor."
            checked={value.gridEnabled}
            onChange={(gridEnabled) => apply({ gridEnabled })}
          />
          <label
            className={`text-graphite flex items-center gap-2 pl-7 text-xs transition-opacity ${
              value.gridEnabled ? "opacity-100" : "opacity-40"
            }`}
          >
            Spacing
            <ScrollSelect
              value={value.gridColumns}
              options={[...GRID_COLUMN_CHOICES]}
              onChange={(gridColumns) => apply({ gridColumns })}
              disabled={!value.gridEnabled}
              label="Grid spacing"
              format={(v) => `${v} columns`}
              className="w-28"
            />
          </label>
        </div>

        <Toggle
          label="Snap to grid"
          hint="Edges land on the grid lines as you drag. Works alongside Snap to align — whichever is nearer wins. Hold Alt to override."
          checked={value.gridSnap}
          onChange={(gridSnap) => apply({ gridSnap })}
        />

        <Toggle
          label="Fade content in"
          hint="Images fade in as a visitor scrolls down. Only on the site — the wall here never fades."
          checked={value.contentFadeIn}
          onChange={(contentFadeIn) => apply({ contentFadeIn })}
        />
      </div>
    </section>
  );
}
