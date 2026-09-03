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
import { docToPlain, serialiseDoc, type RichDoc } from "@/lib/rich-text";
import { SURFACE_LEADING } from "@/lib/type-scale";
import { createWriteQueue } from "@/lib/write-queue";
import {
  collectGuides,
  mergeGuides,
  NO_GUIDES,
  rectOf,
  snapMove,
  snapResize,
  snapResizeFree,
  type Guides,
  type Rect,
} from "@/lib/snap";
import { DEFAULT_GRID_COLUMNS, gridGuides } from "@/lib/grid";
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
  archivePortfolioItems,
  createPortfolioItemDraft,
  createWallText,
  deletePortfolioItem,
  deleteWallSelection,
  deleteWallText,
  restorePortfolioItem,
  savePortfolioItemDetails,
  savePortfolioLayout,
  saveWallLayouts,
  saveWallTextLayout,
  unarchivePortfolioItems,
  updateWallText,
} from "@/app/admin/portfolio-actions";
import { restoreDeleted } from "@/app/admin/undo-actions";
import type { Backup } from "@/lib/undo-backup";
import { RichTextEditor } from "./rich-text-editor";
import { RichTextInline } from "@/components/rich-text";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";
import { useAction } from "./use-action";
import { useUndo } from "./undo-provider";
import { ArchivePopup } from "./archive-popup";
import { ContextMenu, Icons, type MenuEntry } from "./context-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { ImageDialog, type ImageDetails } from "./image-dialog";
import { SelectionToolbar } from "./selection-toolbar";
import { WallGrid } from "./wall-grid";
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
  /**
   * The layer the element was on before it was picked up.
   *
   * Every drag brings its element to the front, so undoing one has to put the
   * layering back as well as the position — otherwise a piece the artist
   * merely nudged stays in front of everything it used to sit behind, and no
   * further undo can reach it.
   */
  originZ: number;
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

/**
 * Where one element sits, as the wall stores it.
 *
 * `SelectedElement` with a layer on top. The group operations produce that
 * shape already and change no layering, while a single drag brings its element
 * to the front — so `z` is optional rather than a second type, and a save that
 * carries none leaves the stack alone.
 *
 * This is the currency of undo on the wall: a move, a resize, a group scale,
 * an align and a distribute are all "these elements were there, now they are
 * here", and one pair of before-and-after lists reverses every one of them.
 */
type Placement = SelectedElement & { z?: number };

/** Below this, a pointer gesture is a tap (select or open), not a drag. */
const DRAG_THRESHOLD_PX = 4;

/** What one text box's autosave carries. */
type TextPatch = Parameters<typeof updateWallText>[1];

/**
 * Everything about a text box that editing it can change.
 *
 * Its placement is deliberately absent: that is moved by dragging, which is
 * already one undo step of its own, and folding the two together would make a
 * nudge and a sentence a single thing to take back.
 */
type TextState = Pick<
  WallText,
  "rich" | "fontSize" | "align" | "bold" | "italic" | "underline" | "colour" | "font"
>;

const textStateOf = (text: WallText): TextState => ({
  rich: text.rich,
  fontSize: text.fontSize,
  align: text.align,
  bold: text.bold,
  italic: text.italic,
  underline: text.underline,
  colour: text.colour,
  font: text.font,
});

/** Whether an editing session changed anything worth an undo step. */
const textStatesDiffer = (a: TextState, b: TextState): boolean =>
  serialiseDoc(a.rich) !== serialiseDoc(b.rich) ||
  a.fontSize !== b.fontSize ||
  a.align !== b.align ||
  a.bold !== b.bold ||
  a.italic !== b.italic ||
  a.underline !== b.underline ||
  a.colour !== b.colour ||
  a.font !== b.font;

/**
 * How long typing must pause before the text box is written.
 *
 * Short enough that leaving the keyboard for a moment saves, long enough that
 * a word is one write rather than five. The editor emits on every `input`
 * event, and each write costs a server action; before this there was one per
 * character.
 */
const TEXT_SAVE_DELAY = 700;

/**
 * And the longest an unsaved change may wait, however continuously she types.
 *
 * A trailing debounce on its own never fires while the input keeps coming, so
 * a paragraph typed without a pause would sit entirely in the browser. This is
 * the ceiling that makes the delay safe.
 */
const TEXT_SAVE_CEILING = 4000;

/**
 * Half the group handle's hit box, in pixels.
 *
 * The handle is centred on the corner of the selection, so this is how far its
 * centre must stay from the edge of the canvas for the whole of it to remain
 * inside — which matters because the canvas clips and a selection may bleed
 * past it.
 */
const HANDLE_INSET = 14;

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

/**
 * The default for a caller that never passes `archived` — a piece's own
 * page, which offers no archive UI at all.
 *
 * A literal `[]` default is evaluated fresh on every call a prop is omitted,
 * so it would give `initialArchived` a new identity on every render. The sync
 * effect below writes state whenever `initialArchived !== lastArchived`,
 * which a fresh array fails unconditionally — a state update during render,
 * every render, forever. One stable array is what makes the identity check
 * mean "the server sent something new" rather than "a function ran again".
 */
const NO_ARCHIVED: PortfolioItem[] = [];

export function PortfolioCanvas({
  items: initialItems,
  texts: initialTexts,
  archived: initialArchived = NO_ARCHIVED,
  snapEnabled,
  gutter,
  gridEnabled = false,
  gridColumns = DEFAULT_GRID_COLUMNS,
  gridSnap = false,
  scope = HOME_WALL,
  fonts = BUILT_IN_FONTS,
}: {
  items: PortfolioItem[];
  texts: WallText[];
  /**
   * Every piece put away from any wall, offered by "Add from archive".
   *
   * Not fetched here — a piece's own page has no such menu entry at all, so
   * a caller that never passes this simply gets none, rather than the
   * component having to know it should not ask.
   */
  archived?: PortfolioItem[];
  snapEnabled: boolean;
  /** Already resolved to 0 when the artist has the gap turned off. */
  gutter: number;
  /** Draw the alignment grid. Editor only — the public wall has no such thing. */
  gridEnabled?: boolean;
  gridColumns?: number;
  /** Snap to the grid's lines, independently of whether they are drawn. */
  gridSnap?: boolean;
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
  const [archived, setArchived] = useState(initialArchived);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /*
    The text queue's own busy flag, kept apart from the drag's. Both describe
    "a write is out", but they start and finish independently — a shared
    boolean means whichever settles first switches the indicator off while the
    other is still away.
  */
  const [savingText, setSavingText] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ vertical: number | null; horizontal: number | null }>({
    vertical: null,
    horizontal: null,
  });
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  /** The archive popup, and where a restored piece should land. */
  const [archivePopup, setArchivePopup] = useState<{
    x: number;
    y: number;
    at: { x: number; y: number };
  } | null>(null);

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
  const { run, track, error: actionError } = useAction();
  const { record } = useUndo();
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
  const [lastArchived, setLastArchived] = useState(initialArchived);
  if (initialArchived !== lastArchived) {
    setLastArchived(initialArchived);
    setArchived(initialArchived);
  }

  // Height comes from the committed lists, never the live drag — otherwise the
  // canvas grows as a piece is pulled down and shifts everything else.
  const ratio = canvasHeightRatio(lastItems, lastTexts);

  const asPercent = useCallback((px: number) => {
    const width = canvasRef.current?.offsetWidth ?? 1;
    return (px / width) * 100;
  }, []);

  /** Either kind of snapping is enough to make a gesture snap at all. */
  const snapsAtAll = snapEnabled || gridSnap;

  /**
   * Every line the gesture about to start may snap to.
   *
   * The two kinds are merged into one set rather than tried in turn, so the
   * nearest simply wins and neither feature has to defer to the other. A grid
   * line that lands on a neighbour's edge collapses into it, widening the
   * edges it accepts instead of competing with it.
   *
   * Note what the grid does *not* carry: the leading/trailing distinction that
   * makes a gutter mean something. A grid line is a place to put an edge —
   * any edge — so the gutter still governs contact between two pieces while
   * the grid governs where a piece sits on the wall.
   */
  const guidesFor = (others: Rect[]): Guides =>
    mergeGuides(
      snapEnabled ? collectGuides(others, ratio, gutter) : NO_GUIDES,
      gridSnap ? gridGuides(gridColumns, ratio) : NO_GUIDES,
    );

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

  /** Writes a set of placements into the optimistic copies the canvas renders. */
  const applyElements = (next: Placement[]) => {
    const byId = new Map(next.map((element) => [element.id, element]));
    setItems((current) =>
      current.map((item) => {
        const moved = byId.get(item.id);
        // Height is never stored — it comes from the cover image — so a piece
        // takes only the three fields the wall actually keeps.
        return moved
          ? { ...item, x: moved.x, y: moved.y, width: moved.width, z: moved.z ?? item.z }
          : item;
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
              z: moved.z ?? text.z,
            }
          : text;
      }),
    );
  };

  /**
   * Applies a set of placements and returns the write.
   *
   * Returned rather than fired, because the two callers want different things
   * from the promise. A gesture hands it to `run`, which reports a failure to
   * the artist and moves on; an undo entry hands it to `track`, which reports
   * it the same way and then rethrows, so the history learns the step did not
   * land instead of quietly moving it to the redo side.
   *
   * One round trip for the whole set, which is the rule every group write here
   * follows: half an arrangement applied is worse than none, because the
   * artist cannot see which half.
   */
  const applyAndWrite = (next: Placement[]): Promise<void> => {
    applyElements(next);
    setSaving(true);
    return saveWallLayouts({
      items: next
        .filter((element) => element.kind === "item")
        .map(({ id, x, y, width, z }) => ({ id, x, y, width, z })),
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
                z: element.z,
              },
            ]
          : [],
      ),
    }).finally(() => setSaving(false));
  };

  /**
   * Remembers a rearrangement, so Cmd+Z can put it back.
   *
   * Everything the artist does to placement on this wall arrives here — a
   * drag, a resize, a group move, a group scale, an align, a distribute — for
   * the reason `Placement` exists: they differ in how the new positions are
   * worked out and not at all in what has to be written to undo them.
   */
  const recordArrangement = (what: string, before: Placement[], after: Placement[]) => {
    record({
      label: what,
      undo: () => track(applyAndWrite(before), `Undoing ${what}`),
      redo: () => track(applyAndWrite(after), `Redoing ${what}`),
    });
  };

  /** A group result: applied, written, and recorded as one step. */
  const applyAndSave = (what: string, before: Placement[], next: Placement[]) => {
    recordArrangement(what, before, next);
    run(applyAndWrite(next), "Saving the arrangement");
  };

  /**
   * Fires a delete and records it, with the rows it removed as the way back.
   *
   * The entry is recorded before the delete has landed, and closes over the
   * promise rather than the result: an undo pressed in the round trip before
   * the rows come back then simply queues behind them, instead of finding no
   * entry and silently reversing whatever the artist did before this.
   *
   * Redo re-runs the delete and throws its backup away, which looks careless
   * and is not. Undo restores the captured rows exactly — ids and all — so
   * what a redo deletes is the same set the first backup already describes,
   * and it stays the way back however many times the pair is pressed.
   */
  const deleteAndRecord = (what: string, remove: () => Promise<Backup>) => {
    const removal = remove();
    record({
      label: what,
      undo: () => track(removal.then(restoreDeleted), `Undoing ${what}`),
      redo: () =>
        track(
          remove().then(() => undefined),
          `Redoing ${what}`,
        ),
    });
    run(removal, `Deleting ${what}`);
  };

  /**
   * Records a creation, whose undo is a delete and whose redo is what that
   * delete gave back.
   *
   * The mirror image of the above, and the reason both deletes and creations
   * come out reversible from one restore endpoint: a row put back carries the
   * id it had, so the thing created, removed and created again is the same
   * thing throughout — a text box's page, a piece's photographs and its own
   * page all survive the round trip.
   */
  const recordCreation = (
    what: string,
    created: Promise<string>,
    remove: (id: string) => Promise<Backup>,
  ) => {
    let removed: Backup | null = null;
    record({
      label: what,
      undo: async () => {
        removed = await track(created.then(remove), `Undoing ${what}`);
      },
      redo: async () => {
        if (removed !== null) await track(restoreDeleted(removed), `Redoing ${what}`);
      },
    });
  };

  /**
   * Puts pieces away, and remembers enough to bring them back where they were.
   *
   * The status is carried per piece rather than assumed. Archiving overwrites
   * it, so a draft put away and restored would come back published — work on
   * the live site the artist never chose to publish, from a keypress that
   * claimed only to undo.
   */
  const archiveAndRecord = (going: PortfolioItem[]) => {
    if (going.length === 0) return;
    const ids = going.map((item) => item.id);
    const before = going.flatMap((item) =>
      item.status === "archived" ? [] : [{ id: item.id, status: item.status }],
    );

    record({
      label: going.length === 1 ? "the archive" : "archiving the images",
      undo: () => track(unarchivePortfolioItems(before, scope), "Undoing the archive"),
      redo: () => track(archivePortfolioItems(ids), "Redoing the archive"),
    });
    run(
      archivePortfolioItems(ids),
      going.length === 1 ? "Archiving the image" : "Archiving the images",
    );
  };

  /**
   * Writes a whole text box's content and styling, for an undo step.
   *
   * Not `patchText`: that one queues, and a queued write reports its failure
   * to `onError` rather than to the caller — so the history would move a step
   * that never landed onto the redo side. The mirror is written here too,
   * because `updateWallText` derives it server-side and does not revalidate,
   * which leaves this copy the only one the wall can read.
   */
  const writeTextState = (id: string, state: TextState, what: string): Promise<void> => {
    setTexts((current) =>
      current.map((text) =>
        text.id === id ? { ...text, ...state, content: docToPlain(state.rich) } : text,
      ),
    );
    return track(updateWallText(id, state), what);
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
      // member would fight the gesture and pull the group apart. The grid is
      // exempt from that — it belongs to the wall, not to any element.
      guides: guidesFor(
        elements
          .filter((element) => !selectedIds.has(element.id))
          .map(({ x, y, width, height }) => ({ x, y, width, height })),
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
      const snapping = snapsAtAll && !moveEvent.altKey;

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
      if (!group.moved) return;
      /*
        `group.start` is the selection as it stood when the gesture began, and
        every frame was computed from it rather than from the frame before —
        so it is exactly the "before" this needs, already held for the reason
        that a clamped element must come back unharmed.
      */
      applyAndSave(
        group.mode === "move" ? "the group move" : "the group scale",
        group.start,
        group.latest,
      );
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

    The write itself is queued rather than fired. The editor emits on every
    `input` event, so calling the action here meant one server action — and,
    through its layout revalidation, one whole-site read — per character. See
    `src/lib/write-queue.ts`.
  */
  const [saves] = useState(() =>
    createWriteQueue<TextPatch>({
      delay: TEXT_SAVE_DELAY,
      maxDelay: TEXT_SAVE_CEILING,
      send: (id, patch) => updateWallText(id, patch),
      onError: (cause) => {
        setSaveError(`Saving the text failed: ${cause instanceof Error ? cause.message : cause}`);
        console.error("[admin] Saving the text failed", cause);
      },
      onBusy: setSavingText,
    }),
  );

  /*
    Flush on the way out, so a box left mid-sentence is not lost to the debounce.
    `pagehide` rather than `beforeunload`: it fires on a mobile tab being
    backgrounded as well as on a close, and it does not block the browser's
    back/forward cache the way `beforeunload` does.
  */
  useEffect(() => {
    const leaving = () => void saves.flush();
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("pagehide", leaving);
      void saves.flush();
    };
  }, [saves]);

  /*
    And when she puts a box down. The debounce is for the keyboard, not for
    the mouse: once the box is no longer being edited there is nothing left to
    coalesce, and waiting would leave "Saving…" showing after the last visible
    reason for it had gone.
  */
  useEffect(() => {
    if (selectedTextId !== null) return;
    void saves.flush();
  }, [selectedTextId, saves]);

  /*
    The current boxes, readable from an effect that must not re-run per
    keystroke. The session effect below fires when the artist puts a box down,
    and needs the box as it stands at that moment — but listing `texts` in its
    dependencies would run it on every character typed. Written from an effect
    of its own, declared first so it has already run when that one reads it:
    effects fire in the order they are declared.
  */
  const textsRef = useRef(texts);
  useEffect(() => {
    textsRef.current = texts;
  });

  /**
   * One editing session in one text box is one undo step.
   *
   * The shortcut belongs to the browser while the caret is in the box — see
   * `swallowsUndo` — so it is only once she has put the box down that the
   * history has anything to offer, and what it offers is the box as she found
   * it. Recording per keystroke instead would need the history to hold every
   * intermediate document, and would then compete with the character-level
   * undo the artist already has inside the box.
   *
   * The whole styling goes with the content, because the formatting bar is
   * part of the same session: colour, face, size and the marks are all changed
   * with the box selected, and taking back "what I did to this box" that left
   * it a different colour would be a strange half of an answer.
   */
  const editingRef = useRef<{ id: string; before: TextState } | null>(null);
  useEffect(() => {
    const session = editingRef.current;
    if (session !== null && session.id !== selectedTextId) {
      const now = textsRef.current.find((text) => text.id === session.id);
      // Gone means she deleted it, which is its own step and already recorded.
      if (now !== undefined) {
        const after = textStateOf(now);
        if (textStatesDiffer(session.before, after)) {
          const { id, before } = session;
          record({
            label: "the text",
            undo: () => writeTextState(id, before, "Undoing the text"),
            redo: () => writeTextState(id, after, "Redoing the text"),
          });
        }
      }
    }

    const opened =
      selectedTextId === null
        ? undefined
        : textsRef.current.find((text) => text.id === selectedTextId);
    editingRef.current =
      opened === undefined ? null : { id: opened.id, before: textStateOf(opened) };
    // `record` and `writeTextState` are stable for this component's lifetime;
    // `texts` is deliberately absent, and read through the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTextId]);

  function patchText(id: string, patch: TextPatch) {
    const { rich, ...rest } = patch;

    /*
      A document identical to the one already held is not a change.

      `read()` fires on blur as well as on input, unconditionally, so clicking
      into a text box and straight back out used to write the row and revalidate
      the whole site having altered nothing. Clicking through several boxes in a
      row — which is what the artist was doing when she met the 1102 — was
      therefore as expensive as typing in all of them.
    */
    const current = texts.find((t) => t.id === id);
    if (
      rich !== undefined &&
      Object.keys(rest).length === 0 &&
      current !== undefined &&
      serialiseDoc(current.rich) === serialiseDoc(rich as RichDoc)
    ) {
      return;
    }

    const local: Partial<WallText> = {
      ...rest,
      ...(rich === undefined ? {} : { rich: rich as RichDoc }),
    };
    setTexts((currentTexts) => currentTexts.map((t) => (t.id === id ? { ...t, ...local } : t)));
    setSaveError(null);
    saves.push(id, patch);
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
      originZ: element.z,
      aspect,
      moved: false,
      latest: { x: element.x, y: element.y, width: element.width, height },
      guides: guidesFor(others),
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
      const snapping = snapsAtAll && !moveEvent.altKey;

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

      /*
        Recorded from the drag's own origin fields rather than from a copy of
        the element taken at pointerdown: they are the numbers every frame was
        computed against, so they are the position the artist would see undone
        even when the gesture ended somewhere the snapping decided.

        A text box keeps its `fontSize` on both sides. It is unchanged by a
        drag, but `applyAndWrite` writes a text row through `saveWallLayouts`,
        which expects one — and reading it off the current box means undo
        cannot leave it holding a stale size.
      */
      const text = drag.kind === "text" ? texts.find((t) => t.id === drag.id) : undefined;
      const placement = (
        at: { x: number; y: number; width: number; height: number },
        z: number,
      ): Placement => ({
        kind: drag.kind === "item" ? "item" : "text",
        id: drag.id,
        x: at.x,
        y: at.y,
        width: at.width,
        height: at.height,
        ...(text === undefined ? {} : { fontSize: text.fontSize }),
        z,
      });

      recordArrangement(
        drag.mode === "move" ? "the move" : "the resize",
        [
          placement(
            {
              x: drag.originX,
              y: drag.originY,
              width: drag.originWidth,
              height: drag.originHeight,
            },
            drag.originZ,
          ),
        ],
        [placement(drag.latest, drag.z)],
      );

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
          onSelect: () => {
            const creating = createWallText(at, scope);
            recordCreation("adding the text", creating, deleteWallText);
            run(creating, "Adding the text");
          },
        },
        // Only on a main wall: a piece's own page composes that piece, and an
        // archived piece is put away from a main wall, not from one of these.
        ...(linksOnward
          ? [
              {
                label: "Add from archive",
                icon: Icons.archive,
                disabled: archived.length === 0,
                onSelect: () => setArchivePopup({ x: clientX, y: clientY, at }),
              },
            ]
          : []),
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
    // Text has no page of its own to preserve, so only the images in the
    // selection are offered — the same reason a text box has no archive entry
    // of its own below.
    const selectedImages = selectedElements.filter((element) => element.kind === "item");

    setMenu({
      x: clientX,
      y: clientY,
      entries: [
        ...(linksOnward && selectedImages.length > 0
          ? [
              {
                label: `Archive ${selectedImages.length} images`,
                icon: Icons.archive,
                onSelect: () => {
                  const ids = selectedImages.map((element) => element.id);
                  const doomed = new Set(ids);
                  const going = items.filter((item) => doomed.has(item.id));
                  setItems((current) => current.filter((item) => !doomed.has(item.id)));
                  setSelectedIds(new Set());
                  archiveAndRecord(going);
                },
              },
            ]
          : []),
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
        ...(linksOnward
          ? [
              {
                label: "Archive image",
                icon: Icons.archive,
                onSelect: () => {
                  setItems((current) => current.filter((i) => i.id !== item.id));
                  archiveAndRecord([item]);
                },
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
            deleteAndRecord("the text", () => deleteWallText(text.id));
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
        {saving || savingText
          ? "Saving…"
          : isGroup
            ? "Drag any of them to move the group, or its corner to scale. Shift-click to add and remove."
            : snapsAtAll
              ? "Drag to move, drag the bottom-right corner to resize, tap to edit. Drag a box over several, or shift-click them, to work on a group. Edges snap — hold Alt to place freely."
              : "Drag to move, drag the bottom-right corner to resize, tap to edit. Drag a box over several, or shift-click them, to work on a group."}
      </p>

      {isGroup && (
        <SelectionToolbar
          count={selectedElements.length}
          onAlign={(mode) =>
            applyAndSave("the alignment", selectedElements, alignSelection(selectedElements, mode))
          }
          onDistribute={(axis) =>
            applyAndSave(
              "the spacing",
              selectedElements,
              distributeSelection(selectedElements, axis),
            )
          }
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
        {/*
          First child, so it sits under the work. Every element carries its own
          z from the database, and the lowest of those is 0 — a grid painted
          later in the tree would draw over anything sitting at the bottom of
          the stack.
        */}
        {gridEnabled && <WallGrid columns={gridColumns} ratio={ratio} />}

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
                      className="h-full w-full bg-transparent p-1 leading-none"
                      style={textStyle(text, { fonts })}
                      // Run sizes are a multiple of this, so the panel can
                      // only show points if it knows what the box is set to.
                      basePt={cqwToPt(text.fontSize)}
                      // The `leading-none` below, and on the public wall.
                      baseLeading={SURFACE_LEADING.wall}
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
                    className="h-full w-full cursor-grab overflow-hidden p-1 leading-none whitespace-pre-wrap select-none"
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
            The handle is a sibling of the box rather than a corner of it, so
            that it can be clamped: work is allowed to bleed past the wall's
            edges — the layout clamps run to -25% and 125% — and the canvas
            clips, so a handle hung off the true corner of the selection was
            simply not there whenever the artist had selected something that
            bled. It scales from the real bounds either way.

            It sits centred on the corner. The clamp is expressed in CSS
            rather than in the percentages, because what has to stay inside the
            canvas is the handle's own 28px box and only CSS knows both units
            at once — `HANDLE_INSET` is half of it. Clamping the percentage
            alone would put the corner on the edge and leave half the handle
            outside it.
          */
          <div
            role="button"
            tabIndex={-1}
            aria-label="Resize the selection"
            onPointerDown={(e) => beginGroup(e, "scale")}
            className="absolute z-[9000] h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none"
            style={{
              left: `min(max(${selectionBounds.x + selectionBounds.width}%, ${HANDLE_INSET}px), calc(100% - ${HANDLE_INSET}px))`,
              top: `min(max(${((selectionBounds.y + selectionBounds.height) / ratio) * 100}%, ${HANDLE_INSET}px), calc(100% - ${HANDLE_INSET}px))`,
            }}
          >
            <span className="bg-accent border-paper absolute inset-0 m-auto block h-5 w-5 border-2" />
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

      {(actionError ?? saveError) && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {actionError ?? saveError}
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
            /*
              Cancelling a brand new image removes the draft and its objects;
              cancelling an edit simply closes. Neither is recorded: the artist
              is putting something down rather than changing the wall, and an
              undo of a cancel would bring back a dialog she has just dismissed.
            */
            if (dialog.isNew) run(deletePortfolioItem(dialog.id), "Discarding the image");
            setDialog(null);
          }}
          onSave={(details) => {
            const { id, initial, isNew } = dialog;
            if (isNew) {
              // The piece exists from the moment the file was chosen, but it is
              // this save that puts it on the wall — so this is the step to
              // take back, and taking it back removes the row the upload made.
              recordCreation("adding the image", Promise.resolve(id), deletePortfolioItem);
            } else {
              record({
                label: "the details",
                undo: () => track(savePortfolioItemDetails(id, initial), "Undoing the details"),
                redo: () => track(savePortfolioItemDetails(id, details), "Redoing the details"),
              });
            }
            run(savePortfolioItemDetails(id, details), "Saving the image");
            setDialog(null);
          }}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}

      {archivePopup && (
        <ArchivePopup
          x={archivePopup.x}
          y={archivePopup.y}
          items={archived}
          onClose={() => setArchivePopup(null)}
          onRestore={(item) => {
            const { at } = archivePopup;
            setArchived((current) => current.filter((i) => i.id !== item.id));
            record({
              label: "the restore",
              // Re-archiving is what puts it back in the box. Its position on
              // the wall goes with it untouched, which is why a redo can land
              // it in the same place rather than at a new pointer.
              undo: () => track(archivePortfolioItems([item.id]), "Undoing the restore"),
              redo: () => track(restorePortfolioItem(item.id, at, scope), "Redoing the restore"),
            });
            run(restorePortfolioItem(item.id, at, scope), "Restoring the piece");
          }}
          // Same confirmation as deleting a piece from the wall — a right
          // click here reaches the identical dialog below, which does not
          // care whether the id it is given was ever on this wall.
          onDeleteForever={(item) => setPendingDelete({ id: item.id, name: item.name })}
        />
      )}

      <ConfirmDialog
        open={pendingGroupDelete !== null}
        title={`Delete ${pendingGroupDelete?.length ?? 0} items?`}
        body="The selected images, their photographs and the selected text will be removed from the wall. Cmd+Z brings them back until you leave this page."
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
          deleteAndRecord("the selection", () =>
            deleteWallSelection({
              items: going.filter((e) => e.kind === "item").map((e) => e.id),
              texts: going.filter((e) => e.kind === "text").map((e) => e.id),
            }),
          );
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this image?"
        body={`“${pendingDelete?.name ?? ""}” and its photographs will be removed from the wall. Cmd+Z brings it back until you leave this page.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete?.id;
          setPendingDelete(null);
          if (!id) return;
          // The id may be a wall piece or an archived one — this dialog
          // serves both "Delete image" and the archive's "Delete forever",
          // so both lists are filtered and only the one that has it changes.
          setItems((c) => c.filter((i) => i.id !== id));
          setArchived((c) => c.filter((i) => i.id !== id));
          deleteAndRecord("the image", () => deletePortfolioItem(id));
        }}
      />
    </div>
  );
}
