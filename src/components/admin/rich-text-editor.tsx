"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  activeSpanMark,
  applyDocToElement,
  docFromElement,
  markSpan,
  type SpanMark,
} from "@/lib/rich-dom";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";
import {
  RICH_LIMITS,
  docToPlain,
  runSizeFromPt,
  runSizeInPt,
  safeHref,
  type RichDoc,
} from "@/lib/rich-text";
import { DEFAULT_ACCENT, INK, PAPER } from "@/lib/colour";

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

const SWATCHES = [INK, "#6d6a66", DEFAULT_ACCENT, PAPER, "#2140d6"];

/** Writes a span mark onto the current selection, or arms it for the next keystroke. */
function applySpanMark(mark: SpanMark, fonts: FontOption[]): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  // Built by the same function that seeds the editor, so the mark cannot be
  // stored without also being visible.
  const span = markSpan(mark, fonts);

  if (range.collapsed) {
    /*
      Nothing is selected, so there is nothing to restyle — the brief is
      explicit that existing text must not change. An empty span with a
      zero-width space gives the caret somewhere to sit that already carries
      the mark, so the next thing typed is inside it.
    */
    span.appendChild(document.createTextNode("​"));
    range.insertNode(span);
    const inner = document.createRange();
    inner.setStart(span.firstChild!, 1);
    inner.collapse(true);
    selection.removeAllRanges();
    selection.addRange(inner);
    return;
  }

  // surroundContents throws when the range crosses an element boundary; the
  // extract/append path handles that case and behaves identically otherwise.
  span.appendChild(range.extractContents());
  range.insertNode(span);
  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(span);
  selection.addRange(after);
}

export function RichTextEditor({
  value,
  onChange,
  fonts = BUILT_IN_FONTS,
  className = "",
  ariaLabel,
  minHeight,
  style,
  basePt = 12,
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

    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    // Capture, because the canvas scrolls inside the page rather than with it.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
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
  /* Held while she types, for the reason given on the same field in TextToolbar. */
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);

  useEffect(() => {
    const remember = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!ref.current?.contains(range.commonAncestorContainer)) return;
      savedRange.current = range.cloneRange();
      setActive(activeSpanMark(selection.anchorNode, ref.current));
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
    restoreSelection();
    applySpanMark(mark, fonts);
    read();
    // The caret often lands inside the new span without the selection moving,
    // so `selectionchange` may not fire and the toolbar would still report the
    // face the artist just replaced.
    const selection = window.getSelection();
    if (selection && ref.current) setActive(activeSpanMark(selection.anchorNode, ref.current));
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
        className={`border-line focus:border-ink w-full border bg-transparent px-1 py-1 text-xs outline-none ${
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
      <span className="relative inline-flex items-center">
        <input
          type="number"
          aria-label="Size"
          min={Math.ceil(runSizeInPt(basePt, RICH_LIMITS.size.min))}
          max={Math.floor(runSizeInPt(basePt, RICH_LIMITS.size.max))}
          step={1}
          value={sizeDraft ?? Math.round(runSizeInPt(basePt, active.size ?? 1))}
          onChange={(e) => {
            setSizeDraft(e.target.value);
            const pt = Number(e.target.value);
            if (!Number.isFinite(pt) || pt <= 0) return;
            span({ size: runSizeFromPt(basePt, pt) });
          }}
          onBlur={() => setSizeDraft(null)}
          className="border-line focus:border-ink w-16 border bg-transparent py-1 pr-6 pl-1.5 text-xs outline-none"
        />
        <span
          aria-hidden
          className="text-graphite/70 pointer-events-none absolute right-1.5 text-[10px]"
        >
          pt
        </span>
      </span>

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
        <div className="relative">
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

        <div className="relative">
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

        <button
          type="button"
          onClick={() => command("removeFormat")}
          className={`${BUTTON} text-graphite`}
        >
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
