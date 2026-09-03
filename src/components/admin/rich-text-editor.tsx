"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  activeAlign,
  activeLeading,
  activeSpanMark,
  applyDocToElement,
  applyLeading,
  applySpanMark,
  clearMarksInRange,
  docFromElement,
  resyncLeading,
  type SpanMark,
} from "@/lib/rich-dom";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";
import {
  RICH_LIMITS,
  docToPlain,
  leadingFromPt,
  leadingInPt,
  runSizeFromPt,
  runSizeInPt,
  safeHref,
  type RichDoc,
  type TextAlign,
} from "@/lib/rich-text";
import { DEFAULT_ACCENT, INK, PAPER } from "@/lib/colour";
import { SURFACE_LEADING } from "@/lib/type-scale";
import { SizeSelect } from "./size-select";

/**
 * A rich-text box, with its formatting controls along the top.
 *
 * The behaviour the brief asks for — "apply to text written with them
 * selected, but don't alter already existing text" — is what `execCommand`
 * has always done and what makes it worth using despite being deprecated:
 * with a selection it marks the selection, and with a collapsed caret it arms
 * the mark for whatever is typed next. Reimplementing that on top of a custom
 * model means owning caret restoration through every re-render, and the
 * browser already does it correctly.
 *
 * Colour, face and size are not `execCommand` marks — its `foreColor` and
 * `fontName` emit `<font>` tags that cannot carry a font id — so those wrap
 * the range in a span themselves, and arm a caret by inserting an empty one
 * to type inside.
 *
 * The element is uncontrolled on purpose. React re-rendering the children of a
 * `contenteditable` moves the caret to the start on every keystroke, so the
 * document is written into the DOM once and read back out, never diffed.
 */

const BUTTON =
  "border-line hover:border-ink flex h-7 min-w-7 items-center justify-center border px-1.5 text-xs transition-colors";
const ACTIVE = "bg-ink text-paper border-ink";

const SWATCHES = [INK, "#6d6a66", DEFAULT_ACCENT, PAPER, "#2140d6"];

/**
 * Alignment is a property of the line, not of the selection.
 *
 * `execCommand` is left to apply it for the same reason it handles bold: it
 * already knows which blocks a selection touches and where to put the caret
 * back afterwards. `styleWithCSS` is deliberately not switched on to force the
 * style form — the flag is document-wide and sticky, so turning it on here
 * would make every later bold and italic emit a styled `<span>` instead of a
 * `<strong>`, which `marksOf` does not read and which would therefore save as
 * unformatted text. `alignOfBlock` reads both forms instead.
 */
/**
 * Closes a popover when the pointer goes down outside it, or on Escape.
 *
 * The same shape `SizeSelect` uses, and for the same two reasons. The listener
 * is on the window in the capture phase because the wall's canvas swallows
 * pointerdown to begin a drag, so a bubbling listener never hears the click
 * that should dismiss this. And Escape is stopped rather than left to bubble,
 * so one press closes the popover and not the formatting panel behind it.
 *
 * The ref goes on a wrapper holding the trigger *and* the popover, so clicking
 * the trigger is not an outside click — otherwise it would close here and
 * reopen on the button's own handler, and the popover would never shut.
 */
function useDismissOnOutside(open: boolean, setOpen: (open: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, setOpen]);

  return ref;
}

const ALIGNMENTS: { value: TextAlign; command: string; label: string; path: string }[] = [
  {
    value: "left",
    command: "justifyLeft",
    label: "Align left",
    path: "M2.5 4h11M2.5 7h7M2.5 10h11M2.5 13h7",
  },
  {
    value: "center",
    command: "justifyCenter",
    label: "Align centre",
    path: "M2.5 4h11M4.5 7h7M2.5 10h11M4.5 13h7",
  },
  {
    value: "right",
    command: "justifyRight",
    label: "Align right",
    path: "M2.5 4h11M6.5 7h7M2.5 10h11M6.5 13h7",
  },
];

export function RichTextEditor({
  value,
  onChange,
  fonts = BUILT_IN_FONTS,
  className = "",
  ariaLabel,
  minHeight,
  style,
  basePt = 12,
  baseLeading = SURFACE_LEADING.copy,
  toolbar = true,
  layout = "top",
}: {
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  fonts?: FontOption[];
  className?: string;
  ariaLabel: string;
  minHeight?: string;
  /** The box's base type, which runs are relative to. */
  style?: React.CSSProperties;
  /**
   * The size of the box this text sits in, in points, which run sizes are
   * shown against. Runs store a multiple, so points only mean anything
   * relative to something — on the wall that is the box's own size, and in a
   * settings field it is body copy at 12pt.
   */
  basePt?: number;
  /**
   * The line spacing this surface paints when a paragraph chooses none.
   *
   * The toolbar has to quote a spacing in points before the artist has picked
   * one, and the honest number is whatever the surface is already set to —
   * `leading-none` on the wall and in a copy field, so the default tracks
   * whatever size the paragraph is in. It is also what she picks to get *back*
   * to the default: choosing it writes no paragraph property at all, so the
   * box goes on following the surface rather than freezing a copy of today's
   * value.
   */
  baseLeading?: number;
  /** Off for the wall, whose boxes carry the toolbar in their own panel. */
  toolbar?: boolean;
  /**
   * Where the controls sit.
   *
   * `top` for a field with room above it. `side` for the wall, where a bar
   * across the top pushed the artist's text down inside a box she had sized
   * herself, and wrapped out of sight entirely in any box narrower than the
   * controls.
   */
  layout?: "top" | "side";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [colourOpen, setColourOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const colourRef = useDismissOnOutside(colourOpen, setColourOpen);
  const linkRef = useDismissOnOutside(linkOpen, setLinkOpen);

  /*
    What we last handed upward. The parent echoes its own state back as
    `value`, and reseeding on that echo would move the caret to the start on
    every keystroke — so a document we produced ourselves is ignored.
  */
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = JSON.stringify(value);
    if (incoming === emitted.current) return;
    emitted.current = incoming;
    applyDocToElement(el, value, fonts);
    // `fonts` is deliberately absent: it is a stable list, and including it
    // would reseed the box — losing the caret — whenever the parent re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /*
    Where the side panel sits, in viewport coordinates.

    Followed rather than computed once: the box can be dragged, resized or
    scrolled while it is being edited, and a panel that stayed where the box
    used to be would be worse than one across the top.
  */
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!toolbar || layout !== "side") return;
    const el = ref.current;
    if (!el) return;

    const PANEL = 176; // w-44, and the gap either side
    const place = () => {
      const box = el.getBoundingClientRect();
      // Flips to the left of the box rather than hanging off the window.
      const right = box.right + 8;
      const left = right + PANEL > window.innerWidth ? box.left - PANEL - 8 : right;
      setAnchor({ left: Math.max(8, left), top: Math.max(8, box.top) });
    };

    /*
      Coalesced to one measurement per frame.

      `getBoundingClientRect` forces a synchronous layout and the `setAnchor`
      that follows it schedules a render, and this ran on every scroll event —
      which a trackpad or a high-refresh wheel delivers faster than frames. The
      panel cannot move more often than it is painted, so the extra work bought
      nothing and was spent inside the wall editor, over a canvas of forty-odd
      pieces, exactly while the artist was dragging the page around to see what
      she was typing.
    */
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };

    place();
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    /*
      Capture, because the canvas scrolls inside the page rather than with it.
      Passive because this only measures — declaring so lets the browser scroll
      without waiting to find out whether the handler will cancel it.
    */
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [toolbar, layout]);

  const read = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const doc = docFromElement(el, fonts);
    emitted.current = JSON.stringify(doc);
    onChange(doc);
  }, [fonts, onChange]);

  /*
    The last selection that was inside this box.

    A toolbar cannot simply `preventDefault` its way out of losing the
    selection: that works for a button, and it stops a <select> from opening
    its list, a colour input from opening its picker, and a text input from
    taking a caret at all — which is how the typeface, size, colour and link
    controls all came to do nothing when clicked. So the selection is tracked
    as it moves and put back before a command runs.
  */
  const savedRange = useRef<Range | null>(null);

  /*
    The marks in force where the caret is, so the toolbar can report the face
    and size the artist is standing in rather than a fixed label. Read from the
    DOM rather than kept alongside it: the browser owns the caret, and a second
    copy of "where am I" is a second thing that can be wrong.
  */
  const [active, setActive] = useState<SpanMark>({});

  /**
   * The alignment of the paragraph the caret is in.
   *
   * Undefined until she chooses one, which is not the same as "left": it means
   * the line follows whatever the box is set to, and the buttons show none
   * pressed rather than claiming a choice she has not made.
   */
  const [align, setAlign] = useState<TextAlign | undefined>(undefined);

  /**
   * The line spacing of the paragraph the caret is in.
   *
   * Undefined for the same reason `align` is: she has chosen none and the line
   * follows the surface. The control shows the surface's own spacing in that
   * case rather than a blank, because a spacing always has a value even when
   * nobody has chosen it.
   */
  const [leading, setLeading] = useState<number | undefined>(undefined);

  useEffect(() => {
    const remember = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!ref.current?.contains(range.commonAncestorContainer)) return;
      savedRange.current = range.cloneRange();
      setActive(activeSpanMark(selection.anchorNode, ref.current));
      setAlign(activeAlign(selection.anchorNode, ref.current));
      setLeading(activeLeading(selection.anchorNode, ref.current));
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, []);

  /** Puts the caret back where the artist left it, before acting on it. */
  const restoreSelection = () => {
    const el = ref.current;
    const range = savedRange.current;
    const selection = window.getSelection();
    if (!el || !selection) return;

    el.focus();
    // A stale range can point at nodes a reseed has replaced; using it would
    // throw and take the whole toolbar down with it.
    if (range && el.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const command = (name: string, arg?: string) => {
    restoreSelection();
    document.execCommand(name, false, arg);
    read();
  };

  const span = (mark: SpanMark) => {
    const el = ref.current;
    if (!el) return;
    restoreSelection();
    applySpanMark(mark, fonts, el);
    read();
    // The caret often lands inside the new span without the selection moving,
    // so `selectionchange` may not fire and the toolbar would still report the
    // face the artist just replaced.
    const selection = window.getSelection();
    if (selection && ref.current) setActive(activeSpanMark(selection.anchorNode, ref.current));
  };

  const alignTo = (option: (typeof ALIGNMENTS)[number]) => {
    command(option.command);
    // The command moves no selection, so `selectionchange` may not fire and
    // the buttons would still show the alignment she just replaced.
    setAlign(option.value);
  };

  /** The surface's own spacing, in the points the control is quoted in. */
  const baseLeadingPt = Math.round(leadingInPt(basePt, baseLeading));

  const leadingTo = (pt: number) => {
    const el = ref.current;
    if (!el) return;
    /*
      Picking the surface's own spacing clears the property rather than
      writing a copy of it, which is the same rule the size control follows —
      a run at the box's size stores no size mark. It matters more here: the
      default is a class on the element, so a paragraph that froze today's
      value would stop following a later change to it.
    */
    const next = pt === baseLeadingPt ? undefined : leadingFromPt(basePt, pt);
    restoreSelection();
    applyLeading(el, next);
    read();
    // Nothing moved the selection, so `selectionchange` may not fire and the
    // control would go on reporting the spacing she just replaced.
    setLeading(next);
  };

  /**
   * Clear: back to the box's own type, for everything selected.
   *
   * `removeFormat` covers the tags and the inline styles but knows nothing of
   * the `data-rt-*` attributes the colour, face and size marks are read from —
   * see clearMarksInRange — so on its own it clears the screen and not the
   * document.
   */
  const clearFormatting = () => {
    restoreSelection();
    document.execCommand("removeFormat");
    const el = ref.current;
    const selection = window.getSelection();
    if (el && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      clearMarksInRange(el, range);
      // Line spacing is a paragraph's property, not a mark on the selection,
      // so Clear leaves it alone — this only puts back a style `removeFormat`
      // might have taken while leaving the attribute it is read from.
      resyncLeading(el, range);
    }
    read();
    setActive({});
  };

  const addLink = () => {
    const href = safeHref(linkDraft);
    if (href === undefined) return;
    setLinkOpen(false);
    setLinkDraft("");
    command("createLink", href);
  };

  const controls = (
    <>
      <select
        aria-label="Typeface"
        value={active.font ?? ""}
        onChange={(e) => e.target.value && span({ font: e.target.value })}
        className={`border-line focus:border-ink h-7 w-full border bg-transparent px-1 text-xs outline-none ${
          layout === "top" ? "max-w-36" : ""
        }`}
      >
        {/*
              Disabled, not hidden: it is how the box reports "no face of its
              own, inheriting the one the box is set in", and Chrome still
              shows a disabled option as the current value. Selectable, it
              would be a choice that does nothing.
            */}
        <option value="" disabled>
          Box typeface
        </option>
        {fonts.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
            {font.label}
          </option>
        ))}
      </select>

      {/*
        Points, converted against the box the text sits in. The stored value is
        still a multiple — see runSizeInPt — so this number moves if the box is
        resized, which is the price of type that scales with the wall.
      */}
      <SizeSelect
        label="Size"
        valuePt={Math.round(runSizeInPt(basePt, active.size ?? 1))}
        // The bounds filter the list rather than clamping a choice: a step
        // this box cannot reach is one the artist could pick and not get.
        minPt={Math.ceil(runSizeInPt(basePt, RICH_LIMITS.size.min))}
        maxPt={Math.floor(runSizeInPt(basePt, RICH_LIMITS.size.max))}
        onChange={(pt) => span({ size: runSizeFromPt(basePt, pt) })}
        className={layout === "top" ? "w-20" : "w-full"}
      />

      <span
        className={layout === "side" ? "bg-line my-0.5 h-px w-full" : "bg-line mx-0.5 h-5 w-px"}
        aria-hidden="true"
      />

      <div
        className={layout === "side" ? "flex gap-1" : "contents"}
        role="group"
        aria-label="Alignment"
      >
        {ALIGNMENTS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={align === option.value}
            onClick={() => alignTo(option)}
            className={`${BUTTON} ${align === option.value ? ACTIVE : ""}`}
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path d={option.path} />
            </svg>
          </button>
        ))}
      </div>

      {/*
        Beside the alignment buttons rather than beside the size field, because
        it belongs to the same thing they do: this sets the paragraph the caret
        is in, while size marks the selection. Quoted in points against the box,
        exactly as the size above it is — see `leadingInPt`.
      */}
      <SizeSelect
        label="Line spacing"
        valuePt={Math.round(leadingInPt(basePt, leading ?? baseLeading))}
        minPt={Math.ceil(leadingInPt(basePt, RICH_LIMITS.leading.min))}
        maxPt={Math.floor(leadingInPt(basePt, RICH_LIMITS.leading.max))}
        onChange={leadingTo}
        prefix={
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <path d="M6.5 3.5h8M6.5 8h8M6.5 12.5h8" />
            <path d="M3 3.5v9M1.6 5 3 3.5 4.4 5M1.6 11 3 12.5 4.4 11" />
          </svg>
        }
        className={layout === "top" ? "w-24" : "w-full"}
      />

      <span
        className={layout === "side" ? "bg-line my-0.5 h-px w-full" : "bg-line mx-0.5 h-5 w-px"}
        aria-hidden="true"
      />

      <div className={layout === "side" ? "flex gap-1" : "contents"}>
        <button
          type="button"
          aria-label="Bold"
          onClick={() => command("bold")}
          className={`${BUTTON} font-bold`}
        >
          B
        </button>
        <button
          type="button"
          aria-label="Italic"
          onClick={() => command("italic")}
          className={`${BUTTON} italic`}
        >
          I
        </button>
        <button
          type="button"
          aria-label="Underline"
          onClick={() => command("underline")}
          className={`${BUTTON} underline`}
        >
          U
        </button>
      </div>

      <span
        className={layout === "side" ? "bg-line my-0.5 h-px w-full" : "bg-line mx-0.5 h-5 w-px"}
        aria-hidden="true"
      />

      <div className={layout === "side" ? "flex items-center gap-1" : "contents"}>
        <div className="relative" ref={colourRef}>
          <button
            type="button"
            aria-label="Text colour"
            aria-expanded={colourOpen}
            onClick={() => setColourOpen((o) => !o)}
            className={BUTTON}
          >
            <span className="border-line h-3 w-3 border bg-current" aria-hidden="true" />
          </button>
          {colourOpen && (
            <div className="border-line bg-paper absolute top-8 left-0 z-50 flex w-40 flex-wrap gap-2 border p-2 shadow-lg">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  onClick={() => {
                    span({ colour: hex });
                    setColourOpen(false);
                  }}
                  className="border-line h-6 w-6 border"
                  style={{ background: hex }}
                />
              ))}
              <input
                type="color"
                aria-label="Pick a colour"
                onChange={(e) => span({ colour: e.target.value })}
                className="h-7 w-full cursor-pointer bg-transparent"
              />
            </div>
          )}
        </div>

        <div className="relative" ref={linkRef}>
          <button
            type="button"
            aria-label="Add a link"
            aria-expanded={linkOpen}
            onClick={() => setLinkOpen((o) => !o)}
            className={BUTTON}
          >
            link
          </button>
          {linkOpen && (
            <div className="border-line bg-paper absolute top-8 left-0 z-50 flex w-64 flex-col gap-2 border p-2 shadow-lg">
              <input
                autoFocus
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLink()}
                placeholder="https://… or /exhibitions"
                spellCheck={false}
                className="border-line focus:border-ink border bg-transparent px-2 py-1 text-xs outline-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={addLink} className={BUTTON}>
                  Link
                </button>
                <button type="button" onClick={() => command("unlink")} className={BUTTON}>
                  Unlink
                </button>
              </div>
              <p className="text-graphite text-[11px]">
                Select the words first. Web addresses need https://
              </p>
            </div>
          )}
        </div>

        <button type="button" onClick={clearFormatting} className={`${BUTTON} text-graphite`}>
          Clear
        </button>
      </div>
    </>
  );

  /*
    Side placement is portalled, and has to be. The canvas clips to its own
    bounds so the editor matches what visitors see, and every text box sits in a
    positioned element carrying its own z-index — so a panel left in the tree is
    clipped away for a box near the canvas edge and painted under the artwork
    for the rest. The context menu portals for exactly this reason.
  */
  const sidePanel =
    toolbar && layout === "side" && anchor !== null && typeof document !== "undefined"
      ? createPortal(
          <div
            role="toolbar"
            aria-orientation="vertical"
            aria-label={`Formatting for ${ariaLabel}`}
            className="border-line fixed z-[9999] flex w-44 flex-col items-stretch gap-1.5 border p-2 shadow-xl"
            // Opaque rather than inherited: it stands over artwork.
            style={{ left: anchor.left, top: anchor.top, backgroundColor: "var(--paper)" }}
          >
            {controls}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex h-full flex-col">
      {toolbar && layout === "top" && (
        <div
          className="border-line bg-paper-sunk/60 flex flex-wrap items-center gap-1 border border-b-0 p-1.5"
          role="toolbar"
          aria-label={`Formatting for ${ariaLabel}`}
        >
          {controls}
        </div>
      )}
      {sidePanel}

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        onInput={read}
        onBlur={read}
        // A paste arrives as whatever the source page was; taking the plain
        // text keeps the box from inheriting a stylesheet's worth of markup.
        // Anything that slipped through would be dropped on read anyway — this
        // only stops it *looking* pasted-in while she edits.
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        style={{ ...style, ...(minHeight ? { minHeight } : {}) }}
        className={`focus:border-ink outline-none ${className}`}
      />
    </div>
  );
}

/** What a box shows when it holds nothing yet. */
export const isBlank = (doc: RichDoc): boolean => docToPlain(doc).trim() === "";
