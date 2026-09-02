"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  aspectOf,
  canvasHeightRatio,
  coverImage,
  cqwToPt,
  HOME_WALL,
  textStyle,
  type PortfolioItem,
  type WallScope,
  type WallText,
} from "@/lib/portfolio";
import type { RichDoc } from "@/lib/rich-text";
import {
  collectGuides,
  rectOf,
  snapMove,
  snapResize,
  snapResizeFree,
  type Guides,
  type Rect,
} from "@/lib/snap";
import {
  alignSelection,
  boundsOf,
  caughtBy,
  distributeSelection,
  marqueeRect,
  moveSelection,
  scaleFactorFor,
  scaleSelection,
  snapScaleFactor,
  type SelectedElement,
} from "@/lib/selection";
import {
  createPortfolioItemDraft,
  createWallText,
  deletePortfolioItem,
  deleteWallSelection,
  deleteWallText,
  savePortfolioItemDetails,
  savePortfolioLayout,
  saveWallLayouts,
  saveWallTextLayout,
  updateWallText,
} from "@/app/admin/portfolio-actions";
import { RichTextEditor } from "./rich-text-editor";
import { RichTextInline } from "@/components/rich-text";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";
import { useAction } from "./use-action";
import { ContextMenu, Icons, type MenuEntry } from "./context-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { ImageDialog, type ImageDetails } from "./image-dialog";
import { SelectionToolbar } from "./selection-toolbar";
import { uploadImage } from "@/lib/client-upload";

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

/**
 * A move or scale of a whole selection.
 *
 * `start` is the selection as it stood when the gesture began, and every frame
 * is computed from it rather than from the frame before. That is what lets an
 * element clamp at a limit and come back unharmed when the artist scales the
 * other way — an incremental sum would have lost the difference for good.
 */
type GroupDrag = {
  mode: "move" | "scale";
  pointerX: number;
  pointerY: number;
  start: SelectedElement[];
  bounds: Rect;
  guides: Guides;
  moved: boolean;
  latest: SelectedElement[];
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
  scope = HOME_WALL,
  fonts = BUILT_IN_FONTS,
}: {
  items: PortfolioItem[];
  texts: WallText[];
  snapEnabled: boolean;
  /** Already resolved to 0 when the artist has the gap turned off. */
  gutter: number;
  /** Built-ins plus the artist's uploads, for the canvas and the toolbar alike. */
  fonts?: FontOption[];
  /**
   * Which wall this is: the home page, one of the artist's custom pages, or a
   * single piece's own page. Only the last makes its elements inert, which is
   * why this is a scope and not a parent id.
   */
  scope?: WallScope;
}) {
  // A custom page's wall behaves exactly as the home wall does; only a piece's
  // page turns its contents into inert composition.
  const linksOnward = scope.kind !== "piece";
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

  /**
   * The multi-selection.
   *
   * Bare ids, with no note of which table they came from: pieces and text
   * boxes are picked and moved as one body, and the two sets of ids are UUIDs
   * that cannot collide. Which kind an id is is answered by looking it up,
   * once, in `elements` below.
   */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  /** The rubber band while it is being drawn, in canvas percentages. */
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [pendingGroupDelete, setPendingGroupDelete] = useState<SelectedElement[] | null>(null);

  /** The details dialog, and the file input that feeds it. */
  const [dialog, setDialog] = useState<{
    id: string;
    initial: ImageDetails;
    imageSrc: string | null;
    isNew: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropPointRef = useRef<{ x: number; y: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const { run, error: actionError } = useAction();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Interaction state lives in a ref, not React state. Reading it from state
   * made every gesture race the render: pointerup saw a stale `moved` flag and
   * treated the drag as a tap.
   */
  const dragRef = useRef<Drag | null>(null);
  const groupRef = useRef<GroupDrag | null>(null);
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

  /**
   * Both kinds of wall element in one list, in the shape the group maths wants.
   *
   * A piece's height is derived here rather than stored, exactly as the public
   * wall derives it, so a selection spanning artwork and text has one geometry
   * and not two.
   */
  const elements: SelectedElement[] = [
    ...items.map((item) => ({
      kind: "item" as const,
      id: item.id,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.width * aspectOf(item),
    })),
    ...texts.map((text) => ({
      kind: "text" as const,
      id: text.id,
      x: text.x,
      y: text.y,
      width: text.width,
      height: text.height,
      fontSize: text.fontSize,
    })),
  ];
  const selectedElements = elements.filter((element) => selectedIds.has(element.id));
  // One element selected is not a group: it keeps the single-element handle and
  // the tap that opens it. The bar and the group handle need two.
  const isGroup = selectedElements.length > 1;
  const selectionBounds = isGroup ? boundsOf(selectedElements) : null;

  /** Writes a group result into the optimistic copies the canvas renders. */
  const applyElements = (next: SelectedElement[]) => {
    const byId = new Map(next.map((element) => [element.id, element]));
    setItems((current) =>
      current.map((item) => {
        const moved = byId.get(item.id);
        // Height is never stored — it comes from the cover image — so a piece
        // takes only the three fields the wall actually keeps.
        return moved ? { ...item, x: moved.x, y: moved.y, width: moved.width } : item;
      }),
    );
    setTexts((current) =>
      current.map((text) => {
        const moved = byId.get(text.id);
        return moved
          ? {
              ...text,
              x: moved.x,
              y: moved.y,
              width: moved.width,
              height: moved.height,
              fontSize: moved.fontSize ?? text.fontSize,
            }
          : text;
      }),
    );
  };

  /** Commits a group result: one round trip for the whole selection. */
  const saveElements = (next: SelectedElement[]) => {
    setSaving(true);
    run(
      saveWallLayouts({
        items: next
          .filter((element) => element.kind === "item")
          .map(({ id, x, y, width }) => ({ id, x, y, width })),
        texts: next.flatMap((element) =>
          element.kind === "text" && element.fontSize !== undefined
            ? [
                {
                  id: element.id,
                  x: element.x,
                  y: element.y,
                  width: element.width,
                  height: element.height,
                  fontSize: element.fontSize,
                },
              ]
            : [],
        ),
      }).finally(() => setSaving(false)),
      "Saving the arrangement",
    );
  };

  const applyAndSave = (next: SelectedElement[]) => {
    applyElements(next);
    saveElements(next);
  };

  /**
   * Window-level pointer tracking for one gesture.
   *
   * Attached synchronously by the caller, never from an effect: an effect runs
   * after the next render, which dropped the opening moves of a fast gesture
   * and made dragging appear dead. `teardownRef` holds the listener removal
   * alone, so a long-press can abandon a gesture without running its `onUp`.
   */
  const trackPointer = (onMove: (event: PointerEvent) => void, onUp: () => void) => {
    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      teardownRef.current = null;
    };
    const handleUp = () => {
      finish();
      onUp();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    teardownRef.current = finish;
  };

  /**
   * Moves or scales the whole selection.
   *
   * Snapping is applied to the selection's bounding box and the resulting
   * delta handed to every member, rather than each member snapping for itself:
   * a group where each element found its own guide would arrive rearranged.
   */
  const beginGroup = (event: React.PointerEvent, mode: GroupDrag["mode"]) => {
    if (event.button !== 0) return;
    const bounds = boundsOf(selectedElements);
    if (!bounds) return;

    event.preventDefault();
    event.stopPropagation();
    cancelLongPress();

    const group: GroupDrag = {
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      start: selectedElements,
      bounds,
      // Guides come from what is *not* selected. A member snapping to another
      // member would fight the gesture and pull the group apart.
      guides: collectGuides(
        elements
          .filter((element) => !selectedIds.has(element.id))
          .map(({ x, y, width, height }) => ({ x, y, width, height })),
        ratio,
        gutter,
      ),
      moved: false,
      latest: selectedElements,
    };
    groupRef.current = group;

    const onMove = (moveEvent: PointerEvent) => {
      const rawX = moveEvent.clientX - group.pointerX;
      const rawY = moveEvent.clientY - group.pointerY;
      if (!group.moved && Math.hypot(rawX, rawY) < DRAG_THRESHOLD_PX) return;
      group.moved = true;

      const dx = asPercent(rawX);
      const dy = asPercent(rawY);
      const snapping = snapEnabled && !moveEvent.altKey;

      if (group.mode === "move") {
        const loose = {
          ...group.bounds,
          x: group.bounds.x + dx,
          y: Math.max(0, group.bounds.y + dy),
        };
        const snapped = snapping
          ? snapMove(loose, group.guides)
          : { x: loose.x, y: loose.y, vertical: null, horizontal: null };
        group.latest = moveSelection(group.start, {
          x: snapped.x - group.bounds.x,
          y: Math.max(0, snapped.y) - group.bounds.y,
        });
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      } else {
        const wanted = scaleFactorFor(group.bounds, { x: dx, y: dy });
        const snapped = snapping
          ? snapScaleFactor(group.bounds, wanted, group.guides)
          : { factor: wanted, vertical: null, horizontal: null };
        group.latest = scaleSelection(group.start, group.bounds, snapped.factor);
        setShown({ vertical: snapped.vertical, horizontal: snapped.horizontal });
      }

      applyElements(group.latest);
    };

    const onUp = () => {
      groupRef.current = null;
      setShown({ vertical: null, horizontal: null });
      // A press that never moved leaves the selection alone. Clicking one
      // member of a group must not throw the rest of it away.
      if (group.moved) saveElements(group.latest);
    };

    trackPointer(onMove, onUp);
  };

  /**
   * Draws the rubber band over empty canvas.
   *
   * Mouse and pen only. A finger drag on bare canvas is how a tall wall is
   * scrolled, and the artist works at a desktop — claiming that gesture would
   * cost a real behaviour to add one she cannot reach without a keyboard
   * anyway, since shift-click is the other half of this feature.
   */
  const beginMarquee = (event: React.PointerEvent) => {
    if (event.button !== 0 || event.pointerType === "touch") return;

    const { clientX, clientY } = event;
    const from = pointAt(clientX, clientY);
    // Shift adds to the selection here for the same reason it does on an
    // element: a second sweep should be able to gather more work.
    const additive = event.shiftKey;
    let drawn: Rect | null = null;

    const onMove = (moveEvent: PointerEvent) => {
      if (
        !drawn &&
        Math.hypot(moveEvent.clientX - clientX, moveEvent.clientY - clientY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      cancelLongPress();
      drawn = marqueeRect(from, pointAt(moveEvent.clientX, moveEvent.clientY));
      setMarquee(drawn);
    };

    const onUp = () => {
      setMarquee(null);
      if (!drawn) {
        // Never became a marquee: a plain click on bare canvas, which puts the
        // current selection down.
        if (!additive) setSelectedIds(new Set());
        return;
      }

      const caught = caughtBy(elements, drawn);
      setSelectedIds((current) => (additive ? new Set([...current, ...caught]) : new Set(caught)));
    };

    trackPointer(onMove, onUp);
  };

  /*
    The optimistic copy applies the patch as typed; the action re-sanitises it
    server-side. `rich` is `unknown` on the action's signature because it comes
    off the wire, but locally it is always a document the editor just produced.
  */
  function patchText(id: string, patch: Parameters<typeof updateWallText>[1]) {
    const { rich, ...rest } = patch;
    const local: Partial<WallText> = {
      ...rest,
      ...(rich === undefined ? {} : { rich: rich as RichDoc }),
    };
    setTexts((current) => current.map((t) => (t.id === id ? { ...t, ...local } : t)));
    run(updateWallText(id, patch), "Saving the text");
  }

  const begin = (
    event: React.PointerEvent,
    kind: Kind,
    element: { id: string; x: number; y: number; width: number; z: number },
    mode: Drag["mode"],
    aspect: number,
    height: number,
  ) => {
    /*
      Only the primary button starts a gesture. A right-click still fires
      pointerdown, and without this it began a drag that moved nowhere — so
      pointerup read it as a tap and opened the editor behind the menu.
      stopPropagation still runs, so right-clicking a piece does not also clear
      the current text selection.
    */
    if (event.button !== 0) {
      event.stopPropagation();
      return;
    }

    /*
      Shift adds an element to the selection, or takes it out again, and starts
      nothing else. It is answered before anything below because the rest of
      this function brings the element to the front and begins a drag, neither
      of which a shift-click asks for.
    */
    if (event.shiftKey && mode === "move") {
      event.preventDefault();
      event.stopPropagation();
      setSelectedTextId(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        if (!next.delete(element.id)) next.add(element.id);
        return next;
      });
      return;
    }

    /*
      Pressing a member of a group drags the whole group; pressing anything
      outside it puts the selection down first, so what follows is the ordinary
      single-element gesture it has always been.
    */
    if (mode === "move" && isGroup) {
      if (selectedIds.has(element.id)) {
        beginGroup(event, "move");
        return;
      }
      setSelectedIds(new Set());
    }

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
        if (drag.kind === "item") {
          const piece = items.find((i) => i.id === drag.id);
          // A clickable piece has a page of its own; anything else has only
          // its details.
          if (piece && piece.clickable && linksOnward) {
            router.push(`/admin/portfolio/${drag.id}`);
          } else if (piece) {
            openDetails(piece);
          }
        } else setSelectedTextId(drag.id);
        return;
      }

      setSaving(true);
      const done = () => setSaving(false);
      if (drag.kind === "item") {
        run(
          savePortfolioLayout(drag.id, {
            x: drag.latest.x,
            y: drag.latest.y,
            width: drag.latest.width,
            z: drag.z,
          }).finally(done),
          "Saving the layout",
        );
      } else {
        run(
          saveWallTextLayout(drag.id, { ...drag.latest, z: drag.z }).finally(done),
          "Saving the layout",
        );
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

  const openDetails = (item: PortfolioItem) =>
    setDialog({
      id: item.id,
      initial: {
        name: item.name,
        information: item.information,
        clickable: item.clickable,
        zoomable: item.zoomable,
      },
      imageSrc: coverImage(item)?.src ?? null,
      isNew: false,
    });

  /**
   * The add-image flow: file first, then details.
   *
   * The row has to exist before the image can be attached to it, so a draft is
   * created here and deleted again if the artist cancels.
   */
  async function addImageFromFile(file: File) {
    const at = dropPointRef.current ?? { x: 4, y: 4 };
    setAdding(true);
    try {
      const id = await createPortfolioItemDraft(at, scope);
      const uploaded = await uploadImage(file, { field: "portfolioItemId", parentId: id });
      setDialog({
        id,
        // Zoomable by default, so a new image is worth clicking without the
        // artist having to find the switch.
        initial: { name: "", information: "", clickable: linksOnward, zoomable: true },
        imageSrc: uploaded.src,
        isNew: true,
      });
    } finally {
      setAdding(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
          // Straight to the file browser: choosing a picture is the first
          // thing the artist wants to do, and everything else follows in a
          // dialog over the wall.
          onSelect: () => {
            dropPointRef.current = at;
            fileRef.current?.click();
          },
        },
        {
          label: "Add text",
          icon: Icons.text,
          onSelect: () => run(createWallText(at, scope), "Adding the text"),
        },
      ],
    });
  };

  /**
   * The menu for a whole selection.
   *
   * Right-clicking one member of a group offers what applies to the group, not
   * what applies to the element under the pointer: "Edit details" on one of
   * six selected pieces would be answering a question the artist did not ask.
   */
  const openGroupMenu = (clientX: number, clientY: number) => {
    setMenu({
      x: clientX,
      y: clientY,
      entries: [
        {
          label: `Delete ${selectedElements.length} items`,
          icon: Icons.trash,
          danger: true,
          onSelect: () => setPendingGroupDelete(selectedElements),
        },
      ],
    });
  };

  const openItemMenu = (clientX: number, clientY: number, item: PortfolioItem) => {
    if (isGroup && selectedIds.has(item.id)) {
      openGroupMenu(clientX, clientY);
      return;
    }

    setMenu({
      x: clientX,
      y: clientY,
      entries: [
        {
          label: "Edit details",
          icon: Icons.pencil,
          onSelect: () => openDetails(item),
        },
        ...(item.clickable && linksOnward
          ? [
              {
                label: "Open its page",
                icon: Icons.image,
                onSelect: () => router.push(`/admin/portfolio/${item.id}`),
              },
            ]
          : []),
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
    if (isGroup && selectedIds.has(text.id)) {
      openGroupMenu(clientX, clientY);
      return;
    }

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
            run(deleteWallText(text.id), "Deleting the text");
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

  /*
    Escape puts a selection down. Nothing else on the canvas listens for it —
    the formatting panel's size list stops the key in the capture phase, and a
    text box being edited and a multi-selection cannot both be open.
  */
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIds(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds]);

  const grip = (dragging: boolean) =>
    `absolute right-0 bottom-0 h-7 w-7 cursor-nwse-resize touch-none transition-opacity ${
      dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
    }`;

  return (
    <div>
      <p className="text-graphite mb-3 h-5 text-xs" aria-live="polite">
        {saving
          ? "Saving…"
          : isGroup
            ? "Drag any of them to move the group, or its corner to scale. Shift-click to add and remove."
            : snapEnabled
              ? "Drag to move, drag the bottom-right corner to resize, tap to edit. Drag a box over several, or shift-click them, to work on a group. Edges snap — hold Alt to place freely."
              : "Drag to move, drag the bottom-right corner to resize, tap to edit. Drag a box over several, or shift-click them, to work on a group."}
      </p>

      {isGroup && (
        <SelectionToolbar
          count={selectedElements.length}
          onAlign={(mode) => applyAndSave(alignSelection(selectedElements, mode))}
          onDistribute={(axis) => applyAndSave(distributeSelection(selectedElements, axis))}
          onDelete={() => setPendingGroupDelete(selectedElements)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <div
        ref={canvasRef}
        onPointerDown={(e) => {
          setSelectedTextId(null);
          beginMarquee(e);
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
          const inSelection = selectedIds.has(text.id);

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
                } ${inSelection ? "shadow-[0_0_0_2px_var(--color-accent)]" : ""}`}
              >
                {selected ? (
                  /*
                    The controls stand beside the box, not above it. A bar
                    across the top pushed her text down inside a box she had
                    sized herself, and in any box narrower than the controls it
                    wrapped out of sight — so the settings appeared to do
                    nothing at exactly the sizes where they matter most.
                  */
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    className="h-full w-full overflow-auto"
                  >
                    <RichTextEditor
                      value={text.rich}
                      onChange={(rich) => patchText(text.id, { rich })}
                      fonts={fonts}
                      ariaLabel="this text box"
                      layout="side"
                      className="h-full w-full bg-transparent p-1 leading-snug"
                      style={textStyle(text, { fonts })}
                      // Run sizes are a multiple of this, so the panel can
                      // only show points if it knows what the box is set to.
                      basePt={cqwToPt(text.fontSize)}
                    />
                  </div>
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
                    /*
                      `select-none` while the box is not being edited. Dragging
                      a marquee across the wall otherwise highlights the words
                      it passes over, so the gesture leaves a trail of selected
                      text behind it. The editor that replaces this paragraph
                      when the box is focused is unaffected, which is what keeps
                      the artist able to select her own words to format them.
                    */
                    className="h-full w-full cursor-grab overflow-hidden p-1 leading-snug whitespace-pre-wrap select-none"
                    style={textStyle(text, { fonts })}
                  >
                    <RichTextInline doc={text.rich} fonts={fonts} />
                  </p>
                )}
              </div>

              {/* A group has one handle of its own; two would compete. */}
              {!isGroup && (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Resize text"
                  onPointerDown={(e) => begin(e, "text", text, "resize", 0, text.height)}
                  className={grip(dragging)}
                >
                  <span className="bg-accent border-paper absolute right-0 bottom-0 block h-5 w-5 border-2" />
                </div>
              )}
            </div>
          );
        })}

        {items.map((item) => {
          const cover = coverImage(item);
          const dragging = activeId === item.id;
          const aspect = aspectOf(item);
          const inSelection = selectedIds.has(item.id);

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
                } ${inSelection ? "shadow-[0_0_0_2px_var(--color-accent)]" : ""}`}
              >
                {cover ? (
                  <Image
                    src={cover.src}
                    alt=""
                    width={cover.width}
                    height={cover.height}
                    sizes="(min-width: 768px) 50vw, 90vw"
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

              {!isGroup && (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label={`Resize ${item.name}`}
                  onPointerDown={(e) =>
                    begin(e, "item", item, "resize", aspect, item.width * aspect)
                  }
                  className={grip(dragging)}
                >
                  <span className="bg-accent border-paper absolute right-0 bottom-0 block h-5 w-5 border-2" />
                </div>
              )}
            </div>
          );
        })}

        {selectionBounds && (
          /*
            The selection's own box, above everything. Wall elements carry
            their own z-index — some in the thousands after the heading
            migration — so a modest number here would be painted underneath the
            artwork it is meant to describe.
          */
          <div
            className="pointer-events-none absolute z-[9000]"
            style={{
              left: `${selectionBounds.x}%`,
              top: `${(selectionBounds.y / ratio) * 100}%`,
              width: `${selectionBounds.width}%`,
              height: `${(selectionBounds.height / ratio) * 100}%`,
            }}
          >
            <div className="border-accent/70 absolute inset-0 border border-dashed" />
          </div>
        )}

        {selectionBounds && (
          /*
            The handle is a sibling of the box rather than a corner of it, and
            its position is clamped to the canvas. Work is allowed to bleed
            past the wall's edges — the layout clamps run to -25% and 125% —
            and the canvas clips, so a handle hung off the true corner of the
            selection was simply not there whenever the artist had selected
            something that bled. It scales from the real bounds either way.
          */
          <div
            role="button"
            tabIndex={-1}
            aria-label="Resize the selection"
            onPointerDown={(e) => beginGroup(e, "scale")}
            className="absolute z-[9000] h-7 w-7 -translate-x-full -translate-y-full cursor-nwse-resize touch-none"
            style={{
              left: `${Math.min(Math.max(selectionBounds.x + selectionBounds.width, 0), 100)}%`,
              top: `${(Math.min(Math.max(selectionBounds.y + selectionBounds.height, 0), ratio) / ratio) * 100}%`,
            }}
          >
            <span className="bg-accent border-paper absolute right-0 bottom-0 block h-5 w-5 border-2" />
          </div>
        )}

        {marquee && (
          <div
            className="border-accent bg-accent/10 pointer-events-none absolute z-[9000] border border-dashed"
            style={{
              left: `${marquee.x}%`,
              top: `${(marquee.y / ratio) * 100}%`,
              width: `${marquee.width}%`,
              height: `${(marquee.height / ratio) * 100}%`,
            }}
          />
        )}

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

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(addImageFromFile(file), "Adding the image");
        }}
      />

      {adding && (
        <p className="text-graphite mt-2 text-xs" aria-live="polite">
          Adding image…
        </p>
      )}

      {actionError && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {actionError}
        </p>
      )}

      {dialog && (
        <ImageDialog
          open
          itemId={dialog.id}
          initial={dialog.initial}
          imageSrc={dialog.imageSrc}
          // Elements on a piece's own page never link anywhere.
          allowClickable={linksOnward}
          onCancel={() => {
            // Cancelling a brand new image removes the draft and its objects;
            // cancelling an edit simply closes.
            if (dialog.isNew) run(deletePortfolioItem(dialog.id), "Discarding the image");
            setDialog(null);
          }}
          onSave={(details) => {
            run(savePortfolioItemDetails(dialog.id, details), "Saving the image");
            setDialog(null);
          }}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}

      <ConfirmDialog
        open={pendingGroupDelete !== null}
        title={`Delete ${pendingGroupDelete?.length ?? 0} items?`}
        body="The selected images, their photographs and the selected text will be removed for good. This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setPendingGroupDelete(null)}
        onConfirm={() => {
          const going = pendingGroupDelete;
          setPendingGroupDelete(null);
          if (!going) return;

          const doomed = new Set(going.map((element) => element.id));
          setItems((current) => current.filter((item) => !doomed.has(item.id)));
          setTexts((current) => current.filter((text) => !doomed.has(text.id)));
          setSelectedIds(new Set());
          run(
            deleteWallSelection({
              items: going.filter((e) => e.kind === "item").map((e) => e.id),
              texts: going.filter((e) => e.kind === "text").map((e) => e.id),
            }),
            "Deleting the selection",
          );
        }}
      />

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
          run(deletePortfolioItem(id), "Deleting the image");
        }}
      />
    </div>
  );
}
