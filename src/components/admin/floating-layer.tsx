"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A panel anchored to a point on the viewport.
 *
 * Portalled onto document.body rather than left in the canvas tree. Wall
 * elements carry their own z-index — some in the thousands — and share a
 * stacking context with anything rendered beside them, so a panel left in the
 * tree paints underneath the artwork however high its z-index is set.
 *
 * Handles the two things every floating surface here needs: staying inside the
 * window, and closing on Escape or a click elsewhere.
 */
export function FloatingLayer({
  x,
  y,
  onClose,
  children,
  className = "",
  label,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
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
    if (box.left < 0) el.style.left = "8px";
    if (box.top < 0) el.style.top = "8px";
  }, [x, y]);

  // The layer only ever exists after a pointer interaction, so it is never
  // part of the server render; this guard is for safety, not hydration.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      aria-label={label}
      className={`border-line fixed z-[9999] border shadow-xl ${className}`}
      // An explicit opaque background: these sit over artwork, and a
      // translucent surface would leave the contents unreadable.
      style={{ left: x, top: y, backgroundColor: "var(--paper)" }}
    >
      {children}
    </div>,
    document.body,
  );
}
