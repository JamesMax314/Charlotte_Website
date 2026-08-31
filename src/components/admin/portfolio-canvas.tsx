"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { aspectOf, canvasHeightRatio, coverImage, type PortfolioItem } from "@/lib/portfolio";
import { collectGuides, rectOf, snapMove, snapResize, type Guides } from "@/lib/snap";
import { savePortfolioLayout } from "@/app/admin/portfolio-actions";

/**
 * The home page wall, editable.
 *
 * Uses exactly the same positioning maths as the public PortfolioWall —
 * percentages of canvas width — so what the artist arranges here is what
 * visitors see. Any divergence between the two would break that promise.
 */

type Drag = {
  id: string;
  mode: "move" | "resize";
  pointerX: number;
  pointerY: number;
  originX: number;
  originY: number;
  originWidth: number;
  z: number;
  aspect: number;
  moved: boolean;
  /** Live values, so the save never has to read back from render state. */
  latest: { x: number; y: number; width: number };
  /**
   * Snap targets, computed once when the gesture starts. The other pieces do
   * not move during a drag, so recomputing them every frame would be waste.
   */
  guides: Guides;
};

/** Below this, a pointer gesture is a tap (open the piece), not a drag. */
const DRAG_THRESHOLD_PX = 4;

export function PortfolioCanvas({
  items: initial,
  snapEnabled,
  gutter,
}: {
  items: PortfolioItem[];
  snapEnabled: boolean;
  /** Already resolved to 0 when the artist has the gap turned off. */
  gutter: number;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** The guide lines currently being snapped to, drawn across the canvas. */
  const [shown, setShown] = useState<{ vertical: number | null; horizontal: number | null }>({
    vertical: null,
    horizontal: null,
  });

  /**
   * Interaction state lives in a ref, not React state.
   *
   * Reading it from state made every gesture race the render: the pointerup
   * handler saw a stale `moved` flag, decided the drag was a tap, and navigated
   * to the edit page instead of moving the piece.
   */
  const dragRef = useRef<Drag | null>(null);

  // Resync when the server sends a fresh list (a piece added or deleted).
  const [lastServer, setLastServer] = useState(initial);
  if (initial !== lastServer) {
    setLastServer(initial);
    setItems(initial);
  }

  /**
   * Height comes from the committed server list, never the live drag. Deriving
   * it from the drag made the canvas grow as a piece was pulled downward, which
   * shifted every other piece and fought the gesture.
   */
  const ratio = canvasHeightRatio(lastServer);

  const asPercent = useCallback((px: number) => {
    const width = canvasRef.current?.offsetWidth ?? 1;
    return (px / width) * 100;
  }, []);

  /** Removes whatever listeners the current gesture installed. */
  const teardownRef = useRef<(() => void) | null>(null);

  // Safety net: if the component unmounts mid-gesture, do not leak listeners.
  useEffect(() => () => teardownRef.current?.(), []);

  const begin = (event: React.PointerEvent, item: PortfolioItem, mode: Drag["mode"]) => {
    event.preventDefault();
    event.stopPropagation();

    // Dragged piece comes to the front, so overlapping work can be reordered
    // just by picking it up.
    const topZ = Math.max(0, ...items.map((i) => i.z)) + 1;
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, z: topZ } : i)));

    const drag: Drag = {
      id: item.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      z: topZ,
      aspect: aspectOf(item),
      moved: false,
      latest: { x: item.x, y: item.y, width: item.width },
      guides: collectGuides(
        items
          .filter((other) => other.id !== item.id)
          .map((other) => rectOf(other, aspectOf(other))),
        ratio,
        gutter,
      ),
    };
    dragRef.current = drag;
    setActiveId(item.id);

    /*
      Listeners are attached here rather than in an effect. An effect runs after
      the next render, so the opening moves of a fast gesture were dropped and
      the drag appeared dead. Attaching synchronously means no movement is ever
      missed. They go on the window because a quick drag outruns the tile and
      the pointer is often released outside it.
    */
    const onMove = (moveEvent: PointerEvent) => {
      const rawX = moveEvent.clientX - drag.pointerX;
      const rawY = moveEvent.clientY - drag.pointerY;
      if (!drag.moved && Math.hypot(rawX, rawY) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;

      const dx = asPercent(rawX);
      const dy = asPercent(rawY);

      // Hold Alt to place a piece freely, ignoring the guides.
      const snapping = snapEnabled && !moveEvent.altKey;

      if (drag.mode === "move") {
        const loose = {
          x: drag.originX + dx,
          y: Math.max(0, drag.originY + dy),
          width: drag.originWidth,
        };
        const snapped = snapping
          ? snapMove(rectOf(loose, drag.aspect), drag.guides)
          : { x: loose.x, y: loose.y, vertical: null, horizontal: null };

        drag.latest = { x: snapped.x, y: Math.max(0, snapped.y), width: drag.originWidth };
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      } else {
        // Only width is adjustable; height follows the cover image's own aspect
        // ratio, so artwork can never be stretched out of shape.
        const loose = {
          x: drag.originX,
          y: drag.originY,
          width: Math.min(120, Math.max(5, drag.originWidth + dx)),
        };
        const snapped = snapping
          ? snapResize(rectOf(loose, drag.aspect), drag.aspect, drag.guides)
          : { width: loose.width, vertical: null, horizontal: null };

        drag.latest = { x: loose.x, y: loose.y, width: Math.min(120, Math.max(5, snapped.width)) };
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      }

      const next = drag.latest;
      setItems((current) => current.map((i) => (i.id === drag.id ? { ...i, ...next } : i)));
    };

    const onUp = () => {
      teardown();
      dragRef.current = null;
      setActiveId(null);
      setShown({ vertical: null, horizontal: null });

      if (!drag.moved) {
        router.push(`/admin/portfolio/${drag.id}`);
        return;
      }

      setSaving(true);
      void savePortfolioLayout(drag.id, { ...drag.latest, z: drag.z }).finally(() =>
        setSaving(false),
      );
    };

    function teardown() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      teardownRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    teardownRef.current = teardown;
  };

  return (
    <div>
      <p className="text-graphite mb-3 h-5 text-xs" aria-live="polite">
        {saving
          ? "Saving layout…"
          : snapEnabled
            ? "Drag to move, drag the bottom-right corner to resize, tap to edit. Edges snap to line up — hold Alt to place freely."
            : "Drag to move, drag the bottom-right corner to resize, tap to edit."}
      </p>

      <div
        ref={canvasRef}
        className="border-line bg-paper-sunk/40 relative w-full overflow-hidden border"
        style={{ aspectRatio: `100 / ${ratio}` }}
      >
        {items.map((item) => {
          const cover = coverImage(item);
          const dragging = activeId === item.id;

          return (
            <div
              key={item.id}
              className="group absolute touch-none select-none"
              style={{
                left: `${item.x}%`,
                // y is a percentage of width; convert to a share of height.
                top: `${(item.y / ratio) * 100}%`,
                width: `${item.width}%`,
                zIndex: item.z,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`Move ${item.name}. Press Enter to edit it.`}
                onPointerDown={(e) => begin(e, item, "move")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    router.push(`/admin/portfolio/${item.id}`);
                }}
                className={`relative block w-full cursor-grab overflow-hidden border ${
                  dragging ? "border-accent shadow-xl" : "border-line/70 hover:border-accent/60"
                }`}
              >
                {cover ? (
                  <Image
                    src={cover.src}
                    alt=""
                    width={cover.width}
                    height={cover.height}
                    sizes="(min-width: 1152px) 576px, 50vw"
                    draggable={false}
                    className="pointer-events-none h-auto w-full"
                  />
                ) : (
                  <div className="bg-paper-sunk text-graphite flex aspect-[4/3] items-center justify-center px-2 text-center text-[10px]">
                    {item.name} — no image yet
                  </div>
                )}

                {item.status === "draft" && (
                  <span className="bg-ink/80 text-paper absolute top-1 left-1 px-1.5 py-0.5 text-[9px] tracking-wide uppercase">
                    Draft
                  </span>
                )}
              </div>

              {/*
                The resize grip sits on the image's own bottom-right corner
                rather than floating beneath it, so the gesture starts where the
                artist expects to grab. Sized generously for a fingertip.
              */}
              <div
                role="button"
                tabIndex={-1}
                aria-label={`Resize ${item.name}`}
                onPointerDown={(e) => begin(e, item, "resize")}
                className={`absolute right-0 bottom-0 h-7 w-7 cursor-nwse-resize touch-none transition-opacity ${
                  dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <span className="bg-accent border-paper absolute right-0 bottom-0 block h-5 w-5 border-2" />
              </div>
            </div>
          );
        })}

        {shown.vertical !== null && (
          <div
            className="bg-accent pointer-events-none absolute top-0 bottom-0 z-50 w-px"
            style={{ left: `${shown.vertical}%` }}
          />
        )}
        {shown.horizontal !== null && (
          <div
            className="bg-accent pointer-events-none absolute right-0 left-0 z-50 h-px"
            style={{ top: `${(shown.horizontal / ratio) * 100}%` }}
          />
        )}

        {items.length === 0 && (
          <p className="text-graphite absolute inset-0 flex items-center justify-center text-sm">
            No pieces yet. Add one to start building the wall.
          </p>
        )}
      </div>
    </div>
  );
}
