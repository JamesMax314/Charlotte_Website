"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  aspectOf,
  canvasHeightRatio,
  coverImage,
  textStyle,
  type PortfolioItem,
  type WallText,
} from "@/lib/portfolio";
import {
  collectGuides,
  rectOf,
  snapMove,
  snapResize,
  snapResizeFree,
  type Guides,
} from "@/lib/snap";
import {
  createPortfolioItem,
  createWallText,
  deletePortfolioItem,
  deleteWallText,
  savePortfolioLayout,
  saveWallTextLayout,
  updateWallText,
} from "@/app/admin/portfolio-actions";
import { TextToolbar } from "./text-toolbar";
import { ContextMenu, Icons, type MenuEntry } from "./context-menu";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * The home page wall, editable.
 *
 * Uses exactly the same positioning maths as the public PortfolioWall —
 * percentages of canvas width — so what the artist arranges here is what
 * visitors see. Any divergence between the two would break that promise.
 */

type Kind = "item" | "text";

type Drag = {
  kind: Kind;
  id: string;
  mode: "move" | "resize";
  pointerX: number;
  pointerY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  z: number;
  /** Only meaningful for pieces, whose height follows the cover image. */
  aspect: number;
  moved: boolean;
  latest: { x: number; y: number; width: number; height: number };
  guides: Guides;
};

/** Below this, a pointer gesture is a tap (select or open), not a drag. */
const DRAG_THRESHOLD_PX = 4;

/**
 * How long a touch must be held to stand in for a right-click.
 *
 * iPadOS has no right-click, and the artist works on a tablet, so without this
 * the context menu — and therefore adding anything at all — would be
 * unreachable on her main device.
 */
const LONG_PRESS_MS = 500;

type Menu = {
  x: number;
  y: number;
  entries: MenuEntry[];
};

export function PortfolioCanvas({
  items: initialItems,
  texts: initialTexts,
  snapEnabled,
  gutter,
}: {
  items: PortfolioItem[];
  texts: WallText[];
  snapEnabled: boolean;
  /** Already resolved to 0 when the artist has the gap turned off. */
  gutter: number;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initialItems);
  const [texts, setTexts] = useState(initialTexts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<{ vertical: number | null; horizontal: number | null }>({
    vertical: null,
    horizontal: null,
  });
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Interaction state lives in a ref, not React state. Reading it from state
   * made every gesture race the render: pointerup saw a stale `moved` flag and
   * treated the drag as a tap.
   */
  const dragRef = useRef<Drag | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  useEffect(() => () => teardownRef.current?.(), []);

  const [lastItems, setLastItems] = useState(initialItems);
  if (initialItems !== lastItems) {
    setLastItems(initialItems);
    setItems(initialItems);
  }
  const [lastTexts, setLastTexts] = useState(initialTexts);
  if (initialTexts !== lastTexts) {
    setLastTexts(initialTexts);
    setTexts(initialTexts);
  }

  // Height comes from the committed lists, never the live drag — otherwise the
  // canvas grows as a piece is pulled down and shifts everything else.
  const ratio = canvasHeightRatio(lastItems, lastTexts);

  const asPercent = useCallback((px: number) => {
    const width = canvasRef.current?.offsetWidth ?? 1;
    return (px / width) * 100;
  }, []);

  const selectedText = texts.find((t) => t.id === selectedTextId) ?? null;

  function patchText(id: string, patch: Parameters<typeof updateWallText>[1]) {
    setTexts((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    void updateWallText(id, patch);
  }

  const begin = (
    event: React.PointerEvent,
    kind: Kind,
    element: { id: string; x: number; y: number; width: number; z: number },
    mode: Drag["mode"],
    aspect: number,
    height: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // Whatever is picked up comes to the front, so overlapping work and text
    // can be reordered just by grabbing it.
    const topZ = Math.max(0, ...items.map((i) => i.z), ...texts.map((t) => t.z)) + 1;
    if (kind === "item") {
      setItems((c) => c.map((i) => (i.id === element.id ? { ...i, z: topZ } : i)));
    } else {
      setTexts((c) => c.map((t) => (t.id === element.id ? { ...t, z: topZ } : t)));
    }

    const others = [
      ...items.filter((i) => i.id !== element.id).map((i) => rectOf(i, aspectOf(i))),
      ...texts
        .filter((t) => t.id !== element.id)
        .map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height })),
    ];

    const drag: Drag = {
      kind,
      id: element.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: element.x,
      originY: element.y,
      originWidth: element.width,
      originHeight: height,
      z: topZ,
      aspect,
      moved: false,
      latest: { x: element.x, y: element.y, width: element.width, height },
      guides: collectGuides(others, ratio, gutter),
    };
    dragRef.current = drag;
    setActiveId(element.id);

    /*
      Listeners are attached here rather than in an effect. An effect runs after
      the next render, so the opening moves of a fast gesture were dropped and
      the drag appeared dead.
    */
    const onMove = (moveEvent: PointerEvent) => {
      const rawX = moveEvent.clientX - drag.pointerX;
      const rawY = moveEvent.clientY - drag.pointerY;
      if (!drag.moved && Math.hypot(rawX, rawY) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      cancelLongPress();

      const dx = asPercent(rawX);
      const dy = asPercent(rawY);
      const snapping = snapEnabled && !moveEvent.altKey;

      if (drag.mode === "move") {
        const loose = {
          x: drag.originX + dx,
          y: Math.max(0, drag.originY + dy),
          width: drag.originWidth,
          height: drag.originHeight,
        };
        const snapped = snapping
          ? snapMove(loose, drag.guides)
          : { x: loose.x, y: loose.y, vertical: null, horizontal: null };
        drag.latest = { ...loose, x: snapped.x, y: Math.max(0, snapped.y) };
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      } else if (drag.kind === "item") {
        // Pieces resize by width alone; height follows the cover image's aspect
        // ratio, so artwork can never be stretched out of shape.
        const loose = {
          x: drag.originX,
          y: drag.originY,
          width: Math.min(120, Math.max(5, drag.originWidth + dx)),
          height: 0,
        };
        const snapped = snapping
          ? snapResize(rectOf(loose, drag.aspect), drag.aspect, drag.guides)
          : { width: loose.width, vertical: null, horizontal: null };
        drag.latest = {
          ...loose,
          width: Math.min(120, Math.max(5, snapped.width)),
        };
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      } else {
        // Text has no artwork to distort, so both axes are free.
        const loose = {
          x: drag.originX,
          y: drag.originY,
          width: Math.min(120, Math.max(5, drag.originWidth + dx)),
          height: Math.min(200, Math.max(2, drag.originHeight + dy)),
        };
        const snapped = snapping
          ? snapResizeFree(loose, drag.guides)
          : { width: loose.width, height: loose.height, vertical: null, horizontal: null };
        drag.latest = {
          ...loose,
          width: Math.min(120, Math.max(5, snapped.width)),
          height: Math.min(200, Math.max(2, snapped.height)),
        };
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      }

      const next = drag.latest;
      if (drag.kind === "item") {
        setItems((c) => c.map((i) => (i.id === drag.id ? { ...i, ...next } : i)));
      } else {
        setTexts((c) => c.map((t) => (t.id === drag.id ? { ...t, ...next } : t)));
      }
    };

    const onUp = () => {
      cancelLongPress();
      teardown();
      dragRef.current = null;
      setActiveId(null);
      setShown({ vertical: null, horizontal: null });

      if (!drag.moved) {
        // A tap opens a piece for editing, but only selects a text box — its
        // editing happens in place, on the wall.
        if (drag.kind === "item") router.push(`/admin/portfolio/${drag.id}`);
        else setSelectedTextId(drag.id);
        return;
      }

      setSaving(true);
      const done = () => setSaving(false);
      if (drag.kind === "item") {
        void savePortfolioLayout(drag.id, {
          x: drag.latest.x,
          y: drag.latest.y,
          width: drag.latest.width,
          z: drag.z,
        }).finally(done);
      } else {
        void saveWallTextLayout(drag.id, { ...drag.latest, z: drag.z }).finally(done);
      }
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

  /** Canvas percentage coordinates for a viewport point. */
  const pointAt = (clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return { x: 4, y: 4 };
    return {
      // Both axes are percentages of width; see the schema.
      x: ((clientX - box.left) / box.width) * 100,
      y: ((clientY - box.top) / box.width) * 100,
    };
  };

  const openCanvasMenu = (clientX: number, clientY: number) => {
    const at = pointAt(clientX, clientY);
    setMenu({
      x: clientX,
      y: clientY,
      entries: [
        {
          label: "Add image",
          icon: Icons.image,
          onSelect: () => void createPortfolioItem(at),
        },
        {
          label: "Add text",
          icon: Icons.text,
          onSelect: () => void createWallText(at),
        },
      ],
    });
  };

  const openItemMenu = (clientX: number, clientY: number, item: PortfolioItem) => {
    setMenu({
      x: clientX,
      y: clientY,
      entries: [
        {
          label: "Edit details",
          icon: Icons.pencil,
          onSelect: () => router.push(`/admin/portfolio/${item.id}`),
        },
        {
          label: "Delete image",
          icon: Icons.trash,
          danger: true,
          onSelect: () => setPendingDelete({ id: item.id, name: item.name }),
        },
      ],
    });
  };

  const openTextMenu = (clientX: number, clientY: number, text: WallText) => {
    setMenu({
      x: clientX,
      y: clientY,
      entries: [
        {
          label: "Edit text",
          icon: Icons.pencil,
          onSelect: () => setSelectedTextId(text.id),
        },
        {
          label: "Delete text",
          icon: Icons.trash,
          danger: true,
          onSelect: () => {
            setTexts((c) => c.filter((t) => t.id !== text.id));
            if (selectedTextId === text.id) setSelectedTextId(null);
            void deleteWallText(text.id);
          },
        },
      ],
    });
  };

  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  /**
   * Starts the touch stand-in for a right-click.
   *
   * Cancelled as soon as the gesture turns into a drag, so pressing and moving
   * still repositions a piece rather than opening a menu.
   */
  const armLongPress = (event: React.PointerEvent, open: (x: number, y: number) => void) => {
    if (event.pointerType !== "touch") return;
    const { clientX, clientY } = event;
    cancelLongPress();
    longPressRef.current = setTimeout(() => {
      teardownRef.current?.();
      dragRef.current = null;
      setActiveId(null);
      open(clientX, clientY);
    }, LONG_PRESS_MS);
  };

  const grip = (dragging: boolean) =>
    `absolute right-0 bottom-0 h-7 w-7 cursor-nwse-resize touch-none transition-opacity ${
      dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
    }`;

  return (
    <div>
      {selectedText && (
        <TextToolbar
          text={selectedText}
          onChange={(patch) => patchText(selectedText.id, patch)}
          onDelete={() => {
            setTexts((c) => c.filter((t) => t.id !== selectedText.id));
            setSelectedTextId(null);
            void deleteWallText(selectedText.id);
          }}
        />
      )}

      <p className="text-graphite mb-3 h-5 text-xs" aria-live="polite">
        {saving
          ? "Saving…"
          : snapEnabled
            ? "Drag to move, drag the bottom-right corner to resize, tap to edit. Edges snap — hold Alt to place freely."
            : "Drag to move, drag the bottom-right corner to resize, tap to edit."}
      </p>

      <div
        ref={canvasRef}
        onPointerDown={(e) => {
          setSelectedTextId(null);
          armLongPress(e, openCanvasMenu);
        }}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          openCanvasMenu(e.clientX, e.clientY);
        }}
        className="border-line bg-paper-sunk/40 relative w-full overflow-hidden border"
        // container-type lets text sizes resolve in cqw, exactly as on the site.
        style={{ aspectRatio: `100 / ${ratio}`, containerType: "inline-size" }}
      >
        {texts.map((text) => {
          const dragging = activeId === text.id;
          const selected = selectedTextId === text.id;

          return (
            <div
              key={text.id}
              className="group absolute touch-none"
              style={{
                left: `${text.x}%`,
                top: `${(text.y / ratio) * 100}%`,
                width: `${text.width}%`,
                height: `${(text.height / ratio) * 100}%`,
                zIndex: text.z,
              }}
            >
              <div
                className={`h-full w-full border ${
                  selected
                    ? "border-accent"
                    : dragging
                      ? "border-accent"
                      : "border-line/50 hover:border-accent/60"
                }`}
              >
                {selected ? (
                  <textarea
                    autoFocus
                    value={text.content}
                    onChange={(e) => patchText(text.id, { content: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-full w-full resize-none bg-transparent p-1 leading-snug outline-none"
                    style={textStyle(text)}
                  />
                ) : (
                  <p
                    onPointerDown={(e) => {
                      begin(e, "text", text, "move", 0, text.height);
                      armLongPress(e, (mx, my) => openTextMenu(mx, my, text));
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openTextMenu(e.clientX, e.clientY, text);
                    }}
                    className="h-full w-full cursor-grab overflow-hidden p-1 leading-snug whitespace-pre-wrap"
                    style={textStyle(text)}
                  >
                    {text.content}
                  </p>
                )}
              </div>

              {/* Move grip, so a selected box can still be dragged while typing. */}
              <div
                role="button"
                tabIndex={-1}
                aria-label="Move text"
                onPointerDown={(e) => begin(e, "text", text, "move", 0, text.height)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openTextMenu(e.clientX, e.clientY, text);
                }}
                className={`bg-accent absolute -top-2 left-0 h-4 w-10 cursor-grab touch-none transition-opacity ${
                  selected || dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              />

              <div
                role="button"
                tabIndex={-1}
                aria-label="Resize text"
                onPointerDown={(e) => begin(e, "text", text, "resize", 0, text.height)}
                className={grip(dragging)}
              >
                <span className="bg-accent border-paper absolute right-0 bottom-0 block h-5 w-5 border-2" />
              </div>
            </div>
          );
        })}

        {items.map((item) => {
          const cover = coverImage(item);
          const dragging = activeId === item.id;
          const aspect = aspectOf(item);

          return (
            <div
              key={item.id}
              className="group absolute touch-none select-none"
              style={{
                left: `${item.x}%`,
                top: `${(item.y / ratio) * 100}%`,
                width: `${item.width}%`,
                zIndex: item.z,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`Move ${item.name}. Press Enter to edit it.`}
                onPointerDown={(e) => {
                  begin(e, "item", item, "move", aspect, item.width * aspect);
                  armLongPress(e, (x, y) => openItemMenu(x, y, item));
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openItemMenu(e.clientX, e.clientY, item);
                }}
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

              <div
                role="button"
                tabIndex={-1}
                aria-label={`Resize ${item.name}`}
                onPointerDown={(e) => begin(e, "item", item, "resize", aspect, item.width * aspect)}
                className={grip(dragging)}
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

        {items.length === 0 && texts.length === 0 && (
          <p className="text-graphite absolute inset-0 flex items-center justify-center text-sm">
            Nothing here yet. Add a piece or some text to start building the wall.
          </p>
        )}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this image?"
        body={`“${pendingDelete?.name ?? ""}” and its photographs will be removed for good. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete?.id;
          setPendingDelete(null);
          if (!id) return;
          setItems((c) => c.filter((i) => i.id !== id));
          void deletePortfolioItem(id);
        }}
      />
    </div>
  );
}
