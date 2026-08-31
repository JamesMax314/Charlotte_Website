"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { canvasHeightRatio, coverImage, type PortfolioItem } from "@/lib/portfolio";
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
  moved: boolean;
};

/** Ignore sub-pixel jitter so a tap still reads as a tap, not a drag. */
const DRAG_THRESHOLD_PX = 4;

export function PortfolioCanvas({ items: initial }: { items: PortfolioItem[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initial);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [saving, setSaving] = useState(false);

  // Resync when the server sends a fresh list (a piece added or deleted).
  const [lastServer, setLastServer] = useState(initial);
  if (initial !== lastServer) {
    setLastServer(initial);
    setItems(initial);
  }

  const ratio = canvasHeightRatio(items);

  const asPercent = useCallback((px: number) => {
    const width = canvasRef.current?.offsetWidth ?? 1;
    return (px / width) * 100;
  }, []);

  function begin(event: React.PointerEvent, item: PortfolioItem, mode: Drag["mode"]) {
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({
      id: item.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      moved: false,
    });
  }

  function move(event: React.PointerEvent) {
    if (!drag) return;
    const dx = asPercent(event.clientX - drag.pointerX);
    const dy = asPercent(event.clientY - drag.pointerY);

    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.pointerX, event.clientY - drag.pointerY) < DRAG_THRESHOLD_PX
    ) {
      return;
    }
    if (!drag.moved) setDrag({ ...drag, moved: true });

    setItems((current) =>
      current.map((item) => {
        if (item.id !== drag.id) return item;
        return drag.mode === "move"
          ? { ...item, x: drag.originX + dx, y: Math.max(0, drag.originY + dy) }
          : // Only width is adjustable; height follows the image's own aspect
            // ratio, so artwork can never be stretched out of proportion.
            { ...item, width: Math.min(100, Math.max(5, drag.originWidth + dx)) };
      }),
    );
  }

  function end(item: PortfolioItem) {
    if (!drag) return;
    const wasDrag = drag.moved;
    setDrag(null);

    if (!wasDrag) {
      router.push(`/admin/portfolio/${item.id}`);
      return;
    }

    const latest = items.find((i) => i.id === item.id);
    if (!latest) return;
    setSaving(true);
    void savePortfolioLayout(item.id, { x: latest.x, y: latest.y, width: latest.width }).finally(
      () => setSaving(false),
    );
  }

  return (
    <div>
      <p className="text-graphite mb-3 h-5 text-xs" aria-live="polite">
        {saving
          ? "Saving layout…"
          : "Drag to move. Drag the corner to resize. Tap a piece to edit it."}
      </p>

      <div
        ref={canvasRef}
        className="border-line bg-paper-sunk/40 relative w-full border"
        style={{ aspectRatio: `100 / ${ratio}` }}
      >
        {items.map((item) => {
          const cover = coverImage(item);
          return (
            <div
              key={item.id}
              className="absolute touch-none select-none"
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
                aria-label={`Move ${item.name}`}
                onPointerDown={(e) => begin(e, item, "move")}
                onPointerMove={move}
                onPointerUp={() => end(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    router.push(`/admin/portfolio/${item.id}`);
                }}
                className={`relative block w-full cursor-grab overflow-hidden border active:cursor-grabbing ${
                  drag?.id === item.id ? "border-accent shadow-lg" : "border-line"
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

              {/* Resize grip. Deliberately large: the artist works on an iPad. */}
              <div
                role="button"
                tabIndex={-1}
                aria-label={`Resize ${item.name}`}
                onPointerDown={(e) => begin(e, item, "resize")}
                onPointerMove={move}
                onPointerUp={() => end(item)}
                className="bg-accent border-paper absolute -right-2 -bottom-2 h-6 w-6 cursor-se-resize touch-none rounded-full border-2"
              />
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="text-graphite absolute inset-0 flex items-center justify-center text-sm">
            No pieces yet. Add one to start building the wall.
          </p>
        )}
      </div>
    </div>
  );
}
