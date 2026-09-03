"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ptOptions } from "@/lib/type-scale";
import { centreScrollTop, nearestScrollTop, type RowBox } from "@/lib/list-scroll";

/**
 * The point size control: a button, and a scrolling list of sizes.
 *
 * It was a native `<select>` first, and that is worth recording because the
 * reasoning looked sound. A native control is reliable on a tablet and needs
 * no dismissal handling — but its popup is drawn by the operating system, and
 * with a rung for every point from 5 to 40 macOS renders all forty-three of
 * them from the top of the screen to the bottom. No CSS reaches that menu:
 * `appearance: base-select` is the only hook, and it did nothing here. A list
 * that cannot be told how tall it is cannot be the answer, so this owns its
 * own.
 *
 * It is deliberately not a `FloatingLayer`. That closes on any pointerdown
 * outside itself, and this control sits *inside* one — the wall's formatting
 * panel — so a portalled list would read as a click elsewhere and take the
 * whole toolbar down with it on the way to picking a size. Rendered inline and
 * absolutely positioned, a click on an option is a click inside the panel,
 * which is what `ColourControl` beside it already relies on.
 */
/** `max-h-48`, and roughly what one row of `py-1.5 text-xs` measures. */
const LIST_MAX_HEIGHT = 192;
const ROW_HEIGHT = 27;

/**
 * Where a row sits within the list's scrollable content.
 *
 * Measured against the list rather than read from `offsetTop`, which is
 * relative to the nearest *positioned* ancestor. That happens to be this list,
 * because it is absolutely positioned — but nothing says it must stay that
 * way, and if it ever stopped being positioned the offsets would silently be
 * measured from somewhere up the page and every row would scroll to the
 * bottom of the ladder.
 */
const rowBox = (list: HTMLElement, row: HTMLElement): RowBox => ({
  top:
    row.getBoundingClientRect().top -
    list.getBoundingClientRect().top -
    list.clientTop +
    list.scrollTop,
  height: row.offsetHeight,
});

export function SizeSelect({
  valuePt,
  minPt,
  maxPt,
  onChange,
  label,
  prefix,
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
  /**
   * A glyph before the value, for when two of these sit side by side.
   *
   * Type size and line spacing are both quoted in points, so without it the
   * toolbar shows two identical-looking "12 pt" buttons and the artist has to
   * hover each one to find out which is which.
   */
  prefix?: React.ReactNode;
  className?: string;
}) {
  const options = ptOptions(valuePt, minPt, maxPt);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** Opens upward when there is no room below; measured, never guessed. */
  const [dropUp, setDropUp] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const commit = (pt: number) => {
    onChange(pt);
    setOpen(false);
    /*
      Focus is deliberately not returned to the button. On the wall, choosing a
      size puts the caret back in the artist's text — that is what `span` does
      — and stealing it back here would undo the one thing she wants next.
    */
  };

  useEffect(() => {
    if (!open) return;

    /*
      Capture, and on the window, for the same reason FloatingLayer does it:
      the canvas swallows pointerdown to begin a drag. A click inside the list
      is left alone so it can land on an option.
    */
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    /*
      Escape closes the list and stops there. Without the capture phase and the
      stop, the panel this sits inside sees the same key on the window and
      closes too, so one press dismissed the formatting panel entirely.
    */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  /*
    Opening the list must move the list and nothing else.

    `scrollIntoView` walks every scrollable ancestor, so in the settings form —
    where this sits in the document flow — opening the dropdown scrolled the
    page to centre it, and the page appeared to jump. The wall was fine only
    because its formatting panel is fixed, which ends the ancestor chain at the
    viewport. `focus` scrolls for the same reason unless told not to.
  */
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const current = list.querySelector<HTMLElement>('[data-current="true"]');
    if (current) {
      list.scrollTop = centreScrollTop(rowBox(list, current), list.clientHeight, list.scrollHeight);
    }
    list.focus({ preventScroll: true });
  }, [open]);

  /*
    Decided from the button, before the list exists.

    Measuring the rendered list would mean a layout effect — which React warns
    about on the server, since this component is server-rendered like every
    client component here — or a frame with the list in the wrong place. The
    height is a known constant, so the button's own position is enough.
  */
  const opensUpward = (): boolean => {
    const button = buttonRef.current;
    if (!button) return false;
    const height = Math.min(LIST_MAX_HEIGHT, options.length * ROW_HEIGHT);
    return window.innerHeight - button.getBoundingClientRect().bottom < height + 16;
  };

  const move = (to: number) => setActive(Math.max(0, Math.min(options.length - 1, to)));

  const onListKey = (e: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(active + 1),
      ArrowUp: () => move(active - 1),
      PageDown: () => move(active + 5),
      PageUp: () => move(active - 5),
      Home: () => move(0),
      End: () => move(options.length - 1),
      Enter: () => commit(options[active]),
      " ": () => commit(options[active]),
      Tab: () => close(),
    };
    const handler = keys[e.key];
    if (!handler) return;
    e.preventDefault();
    handler();
  };

  // Keeps the highlighted row in view as the arrows walk past the edge — and,
  // like opening, moves only the list.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const row = list?.children[active] as HTMLElement | undefined;
    if (!list || !row) return;
    list.scrollTop = nearestScrollTop(rowBox(list, row), list.clientHeight, list.scrollTop);
  }, [active, open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) return setOpen(false);
          setActive(Math.max(0, options.indexOf(valuePt)));
          setDropUp(opensUpward());
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          setActive(Math.max(0, options.indexOf(valuePt)));
          setDropUp(opensUpward());
          setOpen(true);
        }}
        className="border-line focus:border-ink flex h-7 w-full items-center justify-between gap-1 border bg-transparent px-2 text-xs outline-none"
      >
        <span className="flex items-center gap-1">
          {prefix}
          {valuePt} pt
        </span>
        <span aria-hidden className="text-graphite/70 text-[9px]">
          ▼
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${listId}-${options[active]}`}
          tabIndex={-1}
          onKeyDown={onListKey}
          /*
            The height that made this control worth building. Roughly seven
            rows of the ladder, and the rest scrolls.
          */
          className={`border-line bg-paper absolute right-0 left-0 z-50 max-h-48 min-w-20 overflow-y-auto border shadow-lg outline-none ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {options.map((pt, i) => (
            <div
              key={pt}
              id={`${listId}-${pt}`}
              role="option"
              aria-selected={pt === valuePt}
              data-current={pt === valuePt}
              onPointerDown={(e) => {
                // The list has focus; taking it on pointerdown would blur and
                // unmount the row before the click could land on it.
                e.preventDefault();
                commit(pt);
              }}
              onPointerEnter={() => setActive(i)}
              className={`cursor-pointer px-2 py-1.5 text-xs ${
                i === active ? "bg-paper-sunk" : ""
              } ${pt === valuePt ? "font-semibold" : ""}`}
            >
              {pt} pt
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
