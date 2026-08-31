"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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

/**
 * A menu anchored to where the pointer was.
 *
 * Rendered through a portal onto document.body rather than inside the canvas.
 * Wall elements carry their own z-index — some in the thousands — and they
 * share a stacking context with anything rendered alongside them, so a menu
 * left in the tree painted underneath the artwork however high its z-index
 * was set. A portal sidesteps stacking contexts altogether.
 *
 * Positioned with `fixed` against viewport coordinates, and nudged back inside
 * the window when opened near an edge so entries are never clipped.
 */
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Capture phase: the canvas swallows pointerdown to start drags.
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.right > window.innerWidth) el.style.left = `${window.innerWidth - box.width - 8}px`;
    if (box.bottom > window.innerHeight) el.style.top = `${window.innerHeight - box.height - 8}px`;
  }, []);

  // The menu only ever exists after a pointer interaction, so it is never
  // part of the server render; this guard is for safety, not hydration.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="border-line fixed z-[9999] min-w-44 border py-1 shadow-xl"
      // An explicit opaque background: the menu sits over artwork, and a
      // translucent surface would leave the entries unreadable.
      style={{ left: x, top: y, backgroundColor: "var(--paper)" }}
    >
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
    </div>,
    document.body,
  );
}
