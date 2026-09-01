"use client";

import { FloatingLayer } from "./floating-layer";

export interface MenuEntry {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** Simple line icons, sized to the menu's text. */
export const Icons = {
  image: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="1.5" y="2.5" width="13" height="11" />
      <path d="M1.5 11l3.5-3.5 3 3 2.5-2.5 4 4" />
      <circle cx="5.5" cy="6" r="1.1" />
    </svg>
  ),
  text: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M3 3.5h10M8 3.5v9M5.5 12.5h5" />
    </svg>
  ),
  trash: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 6.5v5M9.5 6.5v5" />
    </svg>
  ),
  format: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M3 3.5h10M8 3.5v9M5.5 12.5h5" />
      <path d="M12.5 9.5h2M12.5 12h2" />
    </svg>
  ),
  tag: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M8.2 1.5H14v5.8L7.3 14 2 8.7z" />
      <circle cx="11" cy="4.6" r="1" />
    </svg>
  ),
  eye: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M1 8s2.6-4.2 7-4.2S15 8 15 8s-2.6 4.2-7 4.2S1 8 1 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  ),
  box: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M1.5 4.5h13v9h-13zM1.5 4.5 3 2h10l1.5 2.5M8 2v11.5" />
    </svg>
  ),
  pencil: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M11.2 2.3l2.5 2.5L5.5 13H3v-2.5z" />
    </svg>
  ),
};

/** A right-click menu. Positioning and dismissal come from FloatingLayer. */
export function ContextMenu({
  x,
  y,
  entries,
  onClose,
}: {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  return (
    <FloatingLayer x={x} y={y} onClose={onClose} className="min-w-44 py-1" label="Actions">
      <div role="menu">
        {entries.map((entry) => (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            onClick={() => {
              entry.onSelect();
              onClose();
            }}
            className={`hover:bg-paper-sunk flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
              entry.danger ? "text-red-700" : ""
            }`}
          >
            <span className="text-graphite shrink-0">{entry.icon}</span>
            {entry.label}
          </button>
        ))}
      </div>
    </FloatingLayer>
  );
}
