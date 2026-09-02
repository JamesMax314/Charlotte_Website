/**
 * The bridge between a `contenteditable` element and the rich-text model.
 *
 * This is where pasted markup stops. `docFromElement` walks the DOM and reads
 * only the marks it recognises, so a paste carrying `<script>`, an `onclick`,
 * an iframe or a styled table contributes its text and nothing else — not
 * because those things are stripped, but because nothing ever looks at them.
 *
 * Marks are written to `data-*` attributes as well as to real styles: the
 * style is what the artist sees while editing, the data attribute is what is
 * read back. Reading the model out of computed styles would mean parsing
 * whatever the browser decided `font-family` was, and round-tripping a font id
 * through a CSS stack is a guess. This way it is exact.
 */

import { resolveFontFamily, type FontOption } from "./fonts";
import { mergeRuns, sanitiseDoc, type RichDoc, type RichRun } from "./rich-text";

const MARK_ATTR = {
  colour: "data-rt-colour",
  font: "data-rt-font",
  size: "data-rt-size",
} as const;

/** The marks carried by a span rather than by a tag. */
export type SpanMark = { colour?: string; font?: string; size?: number };

export const hasSpanMark = (mark: SpanMark): boolean =>
  mark.colour !== undefined || mark.font !== undefined || mark.size !== undefined;

/**
 * The span for a colour, face or size mark.
 *
 * Shared by the two places that build one — seeding the editor from a stored
 * document, and applying a mark to a live selection — because they drifted
 * once already: the toolbar set the face's data attribute without its style,
 * so a chosen typeface saved correctly and rendered on the site while showing
 * no change in the editor until the box was reloaded.
 *
 * Both halves matter and neither is redundant. The style is what the artist
 * sees; the data attribute is what is read back, because recovering a font id
 * from whatever the browser made of `font-family` is a guess.
 */
export function markSpan(mark: SpanMark, fonts: FontOption[]): HTMLSpanElement {
  const span = document.createElement("span");
  if (mark.colour !== undefined) {
    span.setAttribute(MARK_ATTR.colour, mark.colour);
    span.style.color = mark.colour;
  }
  if (mark.font !== undefined) {
    span.setAttribute(MARK_ATTR.font, mark.font);
    span.style.fontFamily = resolveFontFamily(mark.font, fonts);
  }
  if (mark.size !== undefined) {
    span.setAttribute(MARK_ATTR.size, String(mark.size));
    span.style.fontSize = `${mark.size}em`;
  }
  return span;
}

/**
 * Drops every size mark inside an element, style and attribute together.
 *
 * Applied to a span that has just been wrapped around a selection: the size
 * being applied wins outright over any inside it. Left in place they would
 * compound, because a nested `em` multiplies — so 30pt wrapped around a
 * half-size run painted at half of 30 — while `marksOf` reads only the
 * innermost, so the document would disagree with the screen either way.
 *
 * Size only. A nested colour or face is merely redundant; those do not
 * multiply.
 */
export function clearSizeMarks(el: HTMLElement): void {
  for (const inner of el.querySelectorAll<HTMLElement>(`[${MARK_ATTR.size}]`)) {
    inner.removeAttribute(MARK_ATTR.size);
    inner.style.removeProperty("font-size");
  }
}

/**
 * Rewrites a span's size style against what it ended up nesting inside.
 *
 * The model says a run's size is a multiple of the *box*. The DOM says `em`,
 * which is a multiple of the parent — and the two are only the same thing when
 * the span is a direct child of the editor. The attribute therefore keeps the
 * true multiple, which is what is read back, and only the style is divided by
 * what it inherits, so the browser paints the size the artist chose.
 *
 * Called after insertion rather than before, because extracting a selection
 * splits the surrounding elements: where the span lands is the only reliable
 * answer to what it inherits.
 */
export function rebaseSizeStyle(span: HTMLElement, size: number | undefined, root: HTMLElement) {
  if (size === undefined) return;
  const inherited = activeSpanMark(span.parentNode, root).size ?? 1;
  span.style.fontSize = `${inherited > 0 ? size / inherited : size}em`;
}

/**
 * The span marks in force at a point in the editor.
 *
 * Walks outward from the caret to the editor root, taking the nearest mark of
 * each kind — which is what makes the toolbar able to show the face and size
 * the artist is actually standing in rather than a fixed label.
 */
export function activeSpanMark(node: Node | null, root: HTMLElement): SpanMark {
  const mark: SpanMark = {};
  let el: HTMLElement | null =
    node === null
      ? null
      : node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;

  while (el && root.contains(el)) {
    if (mark.colour === undefined) {
      const colour = el.getAttribute(MARK_ATTR.colour);
      if (colour) mark.colour = colour;
    }
    if (mark.font === undefined) {
      const font = el.getAttribute(MARK_ATTR.font);
      if (font) mark.font = font;
    }
    if (mark.size === undefined) {
      const size = el.getAttribute(MARK_ATTR.size);
      if (size) mark.size = Number(size);
    }
    if (el === root) break;
    el = el.parentElement;
  }

  return mark;
}

/**
 * Writes a span mark onto the current selection, or arms it for the next keystroke.
 *
 * Lives here rather than in the editor because every line of it is this
 * module's business: it builds a span with `markSpan`, and both of the rules
 * that keep a size mark honest — clearing what it wrapped, rebasing what it
 * nests inside — are the ones above.
 */
export function applySpanMark(mark: SpanMark, fonts: FontOption[], root: HTMLElement): void {
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
    rebaseSizeStyle(span, mark.size, root);
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
  if (mark.size !== undefined) clearSizeMarks(span);
  range.insertNode(span);
  rebaseSizeStyle(span, mark.size, root);
  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(span);
  selection.addRange(after);
}

/** Builds the element for one run, innermost mark first. */
function runToNode(run: RichRun, fonts: FontOption[]): Node {
  let node: Node = document.createTextNode(run.text);

  if (hasSpanMark(run)) {
    const span = markSpan(run, fonts);
    span.appendChild(node);
    node = span;
  }

  for (const [mark, tag] of [
    ["underline", "u"],
    ["italic", "em"],
    ["bold", "strong"],
  ] as const) {
    if (run[mark]) {
      const el = document.createElement(tag);
      el.appendChild(node);
      node = el;
    }
  }

  if (run.href !== undefined) {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", run.href);
    anchor.appendChild(node);
    node = anchor;
  }

  return node;
}

/** One paragraph per block, which is the shape `contenteditable` maintains. */
export function paragraphToNode(runs: RichRun[], fonts: FontOption[]): HTMLElement {
  const block = document.createElement("div");
  if (runs.length === 0) {
    // An empty block collapses to nothing and cannot hold a caret; the <br>
    // is what makes a blank line editable rather than merely stored.
    block.appendChild(document.createElement("br"));
    return block;
  }
  for (const run of runs) block.appendChild(runToNode(run, fonts));
  return block;
}

/** Replaces an element's children with the document, for seeding the editor. */
export function applyDocToElement(el: HTMLElement, doc: RichDoc, fonts: FontOption[]): void {
  el.replaceChildren(
    ...(doc.length === 0
      ? [paragraphToNode([], fonts)]
      : doc.map((paragraph) => paragraphToNode(paragraph, fonts))),
  );
}

/** The marks an element contributes to everything inside it. */
function marksOf(el: HTMLElement, inherited: Omit<RichRun, "text">): Omit<RichRun, "text"> {
  const marks = { ...inherited };
  const tag = el.tagName.toLowerCase();

  // Both the semantic tag and the one execCommand happens to emit.
  if (tag === "strong" || tag === "b") marks.bold = true;
  if (tag === "em" || tag === "i") marks.italic = true;
  if (tag === "u" || tag === "ins") marks.underline = true;

  if (tag === "a") {
    const href = el.getAttribute("href");
    // Left as a raw string: sanitiseDoc is the single place a scheme is judged.
    if (href) marks.href = href;
  }

  const colour = el.getAttribute(MARK_ATTR.colour);
  if (colour) marks.colour = colour;
  const font = el.getAttribute(MARK_ATTR.font);
  if (font) marks.font = font;
  const size = el.getAttribute(MARK_ATTR.size);
  if (size) marks.size = Number(size);

  return marks;
}

/** Elements whose text is not text — a paste can drag any of these in. */
const IGNORED = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT"]);

function collectRuns(node: Node, inherited: Omit<RichRun, "text">, out: RichRun[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text !== "") out.push({ ...inherited, text });
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    if (IGNORED.has(el.tagName)) continue;
    if (el.tagName === "BR") {
      // A <br> inside a block is a line the artist typed with shift+Enter. It
      // is not a paragraph, so it becomes one — the model has no other way to
      // say "line break", and treating it as a paragraph is closer than losing
      // it entirely.
      out.push({ text: "\n" });
      continue;
    }
    collectRuns(el, marksOf(el, inherited), out);
  }
}

/** Blocks that `contenteditable` and pasted markup use to mean "new line". */
const BLOCK = /^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE|TR|SECTION|ARTICLE)$/;

/**
 * Reads a `contenteditable` element back into a document.
 *
 * Always finishes through `sanitiseDoc`, so this function is free to be
 * generous about what it collects: the marks are judged in exactly one place,
 * and an href picked up from a pasted anchor is checked there like any other.
 */
export function docFromElement(el: HTMLElement, fonts: FontOption[] = []): RichDoc {
  const paragraphs: RichRun[][] = [];

  const pushBlock = (node: Node) => {
    const runs: RichRun[] = [];
    collectRuns(node, {}, runs);

    /*
      A trailing <br> is the browser's filler, not a line the artist typed.
      Every empty block carries one so it can hold a caret, and Chrome appends
      one after a final line too — counted as a break, a single blank line
      round-trips into two and the wall grows a gap every time it is saved.
    */
    while (runs.length > 0 && runs[runs.length - 1].text === "\n") runs.pop();

    // A run holding "\n" came from a <br>; split it into further paragraphs.
    let current: RichRun[] = [];
    for (const run of runs) {
      if (run.text === "\n") {
        paragraphs.push(current);
        current = [];
      } else current.push(run);
    }
    paragraphs.push(current);
  };

  // Loose text directly inside the root — what a fresh empty editor holds —
  // is one paragraph; block children are one each.
  const blocks = Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE && BLOCK.test((n as HTMLElement).tagName),
  );

  if (blocks.length === 0) pushBlock(el);
  else for (const block of blocks) pushBlock(block);

  return sanitiseDoc(
    paragraphs.map((runs) => mergeRuns(runs)),
    fonts,
  );
}
