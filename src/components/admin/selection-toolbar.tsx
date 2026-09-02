"use client";

import type { AlignMode } from "@/lib/selection";

/**
 * The bar that appears above the wall when more than one element is selected.
 *
 * It sits in the document flow rather than floating over the canvas, and that
 * is deliberate. `FloatingLayer` — what the context menu and the formatting
 * panel use — closes on any pointerdown outside itself, and every gesture this
 * toolbar exists to support starts with a pointerdown on the canvas. A
 * floating version would dismiss itself the moment the artist touched the
 * thing she had just selected.
 */

const ALIGN_ACTIONS: { mode: AlignMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: "left",
    label: "Align left edges",
    icon: <path d="M2 2v12M4 5h8M4 11h5" />,
  },
  {
    mode: "centre-x",
    label: "Align centres vertically",
    icon: <path d="M8 2v12M4 5h8M5.5 11h5" />,
  },
  {
    mode: "right",
    label: "Align right edges",
    icon: <path d="M14 2v12M4 5h8M7 11h5" />,
  },
  {
    mode: "top",
    label: "Align top edges",
    icon: <path d="M2 2h12M5 4v8M11 4v5" />,
  },
  {
    mode: "centre-y",
    label: "Align centres horizontally",
    icon: <path d="M2 8h12M5 4v8M11 5.5v5" />,
  },
  {
    mode: "bottom",
    label: "Align bottom edges",
    icon: <path d="M2 14h12M5 4v8M11 7v5" />,
  },
];

const BUTTON =
  "border-line hover:border-ink text-graphite hover:text-ink flex h-7 w-7 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={BUTTON}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        {children}
      </svg>
    </button>
  );
}

export function SelectionToolbar({
  count,
  onAlign,
  onDistribute,
  onDelete,
  onClear,
}: {
  count: number;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  // Distributing needs an inside to spread: the outermost two define the span
  // and never move, so with only two selected there is nothing to do.
  const canDistribute = count >= 3;

  return (
    <div
      className="border-line bg-paper mb-3 flex flex-wrap items-center gap-2 border px-3 py-2"
      role="toolbar"
      aria-label="Selected elements"
    >
      <span className="text-graphite mr-1 text-xs">{count} selected</span>

      {ALIGN_ACTIONS.map((action) => (
        <IconButton key={action.mode} label={action.label} onClick={() => onAlign(action.mode)}>
          {action.icon}
        </IconButton>
      ))}

      <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />

      <IconButton
        label="Space evenly across"
        disabled={!canDistribute}
        onClick={() => onDistribute("horizontal")}
      >
        <path d="M2 2v12M14 2v12M7 5h2v6H7z" />
      </IconButton>
      <IconButton
        label="Space evenly down"
        disabled={!canDistribute}
        onClick={() => onDistribute("vertical")}
      >
        <path d="M2 2h12M2 14h12M5 7v2h6V7z" />
      </IconButton>

      <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />

      <button
        type="button"
        onClick={onDelete}
        className="border-line hover:border-ink border px-2 py-1 text-xs text-red-700 transition-colors"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        className="border-line hover:border-ink text-graphite hover:text-ink border px-2 py-1 text-xs transition-colors"
      >
        Deselect
      </button>
    </div>
  );
}
