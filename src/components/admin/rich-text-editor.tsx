"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyDocToElement, docFromElement } from "@/lib/rich-dom";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";
import { docToPlain, safeHref, type RichDoc } from "@/lib/rich-text";
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

/** Relative, because the wall sizes its boxes in `cqw` and runs must scale with them. */
const SIZES: { label: string; value: number }[] = [
  { label: "Small", value: 0.75 },
  { label: "Normal", value: 1 },
  { label: "Large", value: 1.4 },
  { label: "Larger", value: 2 },
  { label: "Huge", value: 3 },
];

const SWATCHES = [INK, "#6d6a66", DEFAULT_ACCENT, PAPER, "#2140d6"];

type SpanMark = { colour?: string; font?: string; size?: number };

/** Writes a span mark onto the current selection, or arms it for the next keystroke. */
function applySpanMark(mark: SpanMark): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const span = document.createElement("span");
  if (mark.colour !== undefined) {
    span.setAttribute("data-rt-colour", mark.colour);
    span.style.color = mark.colour;
  }
  if (mark.font !== undefined) {
    span.setAttribute("data-rt-font", mark.font);
  }
  if (mark.size !== undefined) {
    span.setAttribute("data-rt-size", String(mark.size));
    span.style.fontSize = `${mark.size}em`;
  }

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
  toolbar = true,
}: {
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  fonts?: FontOption[];
  className?: string;
  ariaLabel: string;
  minHeight?: string;
  /** The box's base type, which runs are relative to. */
  style?: React.CSSProperties;
  /** Off for the wall, whose boxes carry the toolbar in their own panel. */
  toolbar?: boolean;
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

  const read = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const doc = docFromElement(el, fonts);
    emitted.current = JSON.stringify(doc);
    onChange(doc);
  }, [fonts, onChange]);

  /** Keeps focus in the text while a control is pressed, so the selection survives. */
  const keepSelection = (event: React.MouseEvent) => event.preventDefault();

  const command = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    read();
  };

  const span = (mark: SpanMark) => {
    ref.current?.focus();
    applySpanMark(mark);
    read();
  };

  const addLink = () => {
    const href = safeHref(linkDraft);
    if (href === undefined) return;
    setLinkOpen(false);
    setLinkDraft("");
    command("createLink", href);
  };

  return (
    <div className="flex flex-col">
      {toolbar && (
        <div
          onMouseDown={keepSelection}
          className="border-line bg-paper-sunk/60 flex flex-wrap items-center gap-1 border border-b-0 p-1.5"
          role="toolbar"
          aria-label={`Formatting for ${ariaLabel}`}
        >
          <select
            aria-label="Typeface"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) span({ font: e.target.value });
              e.target.value = "";
            }}
            className="border-line focus:border-ink max-w-28 border bg-transparent px-1 py-1 text-xs outline-none"
          >
            <option value="">Typeface</option>
            {fonts.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
                {font.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Size"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) span({ size: Number(e.target.value) });
              e.target.value = "";
            }}
            className="border-line focus:border-ink border bg-transparent px-1 py-1 text-xs outline-none"
          >
            <option value="">Size</option>
            {SIZES.map((size) => (
              <option key={size.label} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>

          <span className="bg-line mx-0.5 h-5 w-px" aria-hidden="true" />

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

          <span className="bg-line mx-0.5 h-5 w-px" aria-hidden="true" />

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
      )}

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
