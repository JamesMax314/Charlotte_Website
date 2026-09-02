"use client";

import { ptOptions } from "@/lib/type-scale";

/**
 * The point size control, shared by the box's toolbar and the run panel.
 *
 * Native rather than a custom listbox, for the reason already written beside
 * the typeface control: it is reliable on a tablet — where it opens as the
 * system wheel picker — and it needs no dismissal handling inside a panel that
 * is already floating.
 *
 * It replaced a number input with a spinner, which had two faults a list
 * cannot have. Typing committed on every keystroke, and in the run panel that
 * commit moves focus back into the text, so the first digit threw the artist
 * out of the field. And a spinner invites repeated small commits, each one
 * another span written into her document.
 */
export function SizeSelect({
  valuePt,
  minPt,
  maxPt,
  onChange,
  label,
  className = "",
}: {
  /** The size currently in force, in points, rounded for display. */
  valuePt: number;
  /**
   * The range this field can actually reach. Steps outside it are not offered
   * rather than clamped — see `ptOptions`.
   */
  minPt: number;
  maxPt: number;
  onChange: (pt: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={valuePt}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`border-line focus:border-ink border bg-transparent px-2 py-1 text-xs outline-none ${className}`}
    >
      {ptOptions(valuePt, minPt, maxPt).map((pt) => (
        // The unit is on every option, which is what lets the old absolutely
        // positioned "pt" suffix and the padding it needed disappear.
        <option key={pt} value={pt}>
          {pt} pt
        </option>
      ))}
    </select>
  );
}
