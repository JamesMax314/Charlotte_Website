/**
 * Rich text, as a model rather than as HTML.
 *
 * Everything the artist types is rendered on the public site, so the tempting
 * shape — store a string of HTML, render it with `dangerouslySetInnerHTML` —
 * puts a script-injection surface behind an admin password and a sanitiser
 * that has to be right forever. This stores a structured document instead and
 * renders it by building React elements, so there is no path from stored text
 * to executable markup at all. The editor serialises the DOM *into* this
 * shape, which is where untrusted markup stops: anything unrecognised is not
 * escaped, it is simply never read.
 *
 * A document is paragraphs of runs. Runs carry the marks; paragraphs carry the
 * line structure that a blank line used to give the copy fields.
 */

import { isKnownFontId, type FontOption } from "./fonts";

export interface RichRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Six-digit hex, or absent to inherit the box's colour. */
  colour?: string;
  /** A key into the font registry, or absent to inherit. */
  font?: string;
  /** A multiple of the surrounding size, so type still scales with the wall. */
  size?: number;
  /** Absolute http(s), or a site-relative path beginning with `/`. */
  href?: string;
}

/** How a paragraph sits in its box. */
export type TextAlign = "left" | "center" | "right";

/**
 * A paragraph: its runs, and the alignment the artist gave that line.
 *
 * Alignment belongs to the paragraph rather than to the box, because the
 * paragraph is the only thing both surfaces have. A wall text box has a row of
 * its own to hang a setting on; the About, Contact and Privacy copy is one
 * document with no box at all, so a box-level setting could only ever align a
 * whole page of prose at once.
 *
 * Absent means "whatever the box is set to", which is what keeps every
 * document written before alignment existed rendering exactly as it did.
 */
export interface RichParagraph {
  runs: RichRun[];
  align?: TextAlign;
  /**
   * Line spacing, as a multiple of the *box's* type size.
   *
   * Stored as a multiple for the same reason a run's size is: the wall sizes
   * its boxes in `cqw` so type scales with the arrangement, and a spacing in
   * absolute points would stop scaling with it — the same box would open up or
   * crush at another viewport width. The artist still chooses it in points;
   * see `leadingInPt`, which is the view.
   *
   * Absent means "whatever the surface is set to" — `leading-snug` on the
   * wall, `leading-relaxed` in the copy fields — which is what keeps every
   * document written before line spacing existed rendering exactly as it did.
   */
  leading?: number;
}
export type RichDoc = RichParagraph[];

export const EMPTY_DOC: RichDoc = [];

/** The marks a run may carry, as the editor and toolbar name them. */
export const MARK_KEYS = ["bold", "italic", "underline", "colour", "font", "size", "href"] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

/**
 * Bounds. Generous for a portfolio, small enough that one box cannot make a
 * D1 row unreadable or a page unrenderable.
 */
export const RICH_LIMITS = {
  /** Characters across the whole document. */
  text: 20_000,
  paragraphs: 400,
  runsPerParagraph: 400,
  size: { min: 0.2, max: 6 },
  /**
   * Line spacing, as a multiple of the box.
   *
   * Wider at the top than `size` and much narrower at the bottom: leading well
   * under the type size sets lines overlapping, which is a way to make a box
   * unreadable rather than a look worth reaching. Four times the box is enough
   * for the airiest thing a portfolio wants.
   */
  leading: { min: 0.5, max: 4 },
} as const;

/**
 * The precision a size multiple is held to.
 *
 * Three decimals, not two. The multiple is quoted back to the artist in points
 * against the box it sits in, so the rounding error is multiplied by the box —
 * and at the top of the range, where a box can be nearly 200pt, two decimals
 * cost her the size she picked: 96pt stored as 0.49 reads back as 95. Three
 * caps the error below a fifth of a point everywhere. Widening it leaves
 * existing two-decimal values untouched, so nothing is rewritten and the
 * published hash does not move.
 */
const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * A run's size in points, given the size of the box it sits in.
 *
 * Runs store a *multiple* of the surrounding size, not an absolute one, so
 * that a box holding mixed sizes stays coherent when it is resized and so type
 * still scales with the wall. Points are therefore a view, computed against
 * whatever the box is currently set to — which is why this takes a base rather
 * than reading one.
 */
export const runSizeInPt = (basePt: number, multiple = 1): number => basePt * multiple;

/**
 * The multiple to store for a point size the artist chose.
 *
 * Rounded and clamped to the same bounds as `clampSize`, which sanitises it
 * again on the way into the database — a run at exactly the box's size is
 * stored as no size mark at all, so choosing the base size clears the mark
 * rather than writing a redundant 1.
 */
export const runSizeFromPt = (basePt: number, pt: number): number => {
  if (!(basePt > 0)) return 1;
  const multiple = round(pt / basePt);
  return Math.min(Math.max(multiple, RICH_LIMITS.size.min), RICH_LIMITS.size.max);
};

/**
 * A paragraph's line spacing in points, given the size of the box it sits in.
 *
 * The same view `runSizeInPt` is: a paragraph stores a multiple so that
 * spacing scales with the wall, and points only mean anything relative to
 * something — on the wall that is the box's own size, and in a settings field
 * it is body copy at 12pt.
 */
export const leadingInPt = (basePt: number, multiple: number): number => basePt * multiple;

/** The multiple to store for a spacing in points the artist chose. */
export const leadingFromPt = (basePt: number, pt: number): number => {
  if (!(basePt > 0)) return 1;
  const multiple = round(pt / basePt);
  return Math.min(Math.max(multiple, RICH_LIMITS.leading.min), RICH_LIMITS.leading.max);
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A link we are willing to render.
 *
 * `javascript:` is the whole reason this exists — a stored `javascript:alert(1)`
 * in an href runs on every visitor's machine, and it is the one injection this
 * model does not otherwise close off. Site-relative paths are allowed so she
 * can link to her own pages; protocol-relative `//evil.com` is not, because it
 * looks relative and is not.
 */
export const safeHref = (input: unknown): string | undefined => {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return undefined;

  if (trimmed.startsWith("//")) return undefined;
  if (trimmed.startsWith("/")) return trimmed.slice(0, 2000);

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString().slice(0, 2000);
  } catch {
    return undefined;
  }
};

/**
 * Strips the control characters a paste can carry.
 *
 * Newlines are handled by the paragraph split rather than kept inside a run,
 * so a run's text is always a single line — which is what lets the renderer
 * emit runs without worrying about whitespace collapsing.
 */
const cleanText = (value: string): string =>
  value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");

const clampSize = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = round(value);
  if (rounded === 1) return undefined; // the default carries no information
  return Math.min(Math.max(rounded, RICH_LIMITS.size.min), RICH_LIMITS.size.max);
};

/**
 * Line spacing, sanitised.
 *
 * Unlike `clampSize` there is no value that means "the default": a run at the
 * box's own size is a redundant 1 and is dropped, but a paragraph's default
 * spacing is whatever the surface renders at — `leading-snug` on the wall,
 * `leading-relaxed` in the copy fields — and no single number stands for both.
 * So absence is the only way to say "follow the surface", and every number in
 * range is kept. Returning to the default is the editor's job; see
 * `baseLeading` there.
 */
const clampLeading = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = round(value);
  return Math.min(Math.max(rounded, RICH_LIMITS.leading.min), RICH_LIMITS.leading.max);
};

/**
 * Cleans one run, dropping every mark it cannot vouch for.
 *
 * Marks are omitted rather than defaulted so a stored document stays small and
 * so `undefined` means exactly one thing: inherit from the box.
 */
const sanitiseRun = (input: unknown, fonts: FontOption[]): RichRun | null => {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const text = cleanText(typeof raw.text === "string" ? raw.text : "");
  if (text === "") return null;

  const run: RichRun = { text };
  if (raw.bold === true) run.bold = true;
  if (raw.italic === true) run.italic = true;
  if (raw.underline === true) run.underline = true;

  if (typeof raw.colour === "string" && HEX.test(raw.colour)) run.colour = raw.colour.toLowerCase();
  // An unknown font id would resolve to Inter silently; dropping it makes the
  // run inherit the box's face instead, which is the honest fallback.
  if (typeof raw.font === "string" && isKnownFontId(raw.font, fonts)) run.font = raw.font;

  const size = clampSize(raw.size);
  if (size !== undefined) run.size = size;

  const href = safeHref(raw.href);
  if (href !== undefined) run.href = href;

  return run;
};

/** True when two runs differ only by their text, so they can be joined. */
const sameMarks = (a: RichRun, b: RichRun): boolean =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.colour === b.colour &&
  a.font === b.font &&
  a.size === b.size &&
  a.href === b.href;

/**
 * Joins neighbouring runs that carry identical marks.
 *
 * The editor produces one run per DOM text node, so typing a word inside a
 * bold span can yield a dozen adjacent identical runs. Left alone they grow
 * the row without bound and make every diff unreadable.
 */
export const mergeRuns = (runs: RichRun[]): RichRun[] => {
  const merged: RichRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last, run)) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
};

const ALIGNMENTS: readonly TextAlign[] = ["left", "center", "right"];

const sanitiseAlign = (value: unknown): TextAlign | undefined =>
  ALIGNMENTS.find((option) => option === value);

/**
 * Reads a stored paragraph, in either shape it can be in.
 *
 * A paragraph carrying no alignment is stored as the bare array of runs it has
 * always been — see serialiseDoc — so both shapes are current, and neither is
 * a legacy form that could ever be migrated away.
 */
const storedParagraph = (
  raw: unknown,
): { runs: unknown[]; align?: TextAlign; leading?: number } | null => {
  if (Array.isArray(raw)) return { runs: raw };
  if (typeof raw !== "object" || raw === null) return null;
  const { runs, align, leading } = raw as { runs?: unknown; align?: unknown; leading?: unknown };
  if (!Array.isArray(runs)) return null;
  return { runs, align: sanitiseAlign(align), leading: clampLeading(leading) };
};

/**
 * The one place an untrusted document becomes a trusted one.
 *
 * Everything that reads stored rich text goes through here — not only the
 * editor's output but the database read as well, because a row can predate a
 * rule or be edited by hand.
 */
export const sanitiseDoc = (input: unknown, fonts: FontOption[] = []): RichDoc => {
  if (!Array.isArray(input)) return EMPTY_DOC;

  const doc: RichDoc = [];
  let budget = RICH_LIMITS.text;

  for (const rawParagraph of input.slice(0, RICH_LIMITS.paragraphs)) {
    const stored = storedParagraph(rawParagraph);
    if (!stored) continue;

    const runs: RichRun[] = [];
    for (const rawRun of stored.runs.slice(0, RICH_LIMITS.runsPerParagraph)) {
      if (budget <= 0) break;
      const run = sanitiseRun(rawRun, fonts);
      if (!run) continue;
      if (run.text.length > budget) run.text = run.text.slice(0, budget);
      budget -= run.text.length;
      runs.push(run);
    }

    // An empty paragraph is a deliberate blank line, so it survives — but a
    // trailing run of them, which is what Enter at the end of a box produces,
    // is trimmed below.
    const paragraph: RichParagraph = { runs: mergeRuns(runs) };
    if (stored.align !== undefined) paragraph.align = stored.align;
    if (stored.leading !== undefined) paragraph.leading = stored.leading;
    doc.push(paragraph);
  }

  while (doc.length > 0 && doc[doc.length - 1].runs.length === 0) doc.pop();
  return doc;
};

/** Reads the JSON column, degrading to the plain-text mirror rather than throwing. */
export const parseDoc = (
  json: string | null | undefined,
  fallbackPlain = "",
  fonts: FontOption[] = [],
): RichDoc => {
  if (typeof json === "string" && json !== "") {
    try {
      return sanitiseDoc(JSON.parse(json), fonts);
    } catch {
      // A corrupt value must not take the page down — the plain mirror is
      // exactly the safety net it exists to be.
      console.error("[rich-text] stored document could not be parsed");
    }
  }
  return docFromPlain(fallbackPlain);
};

/**
 * The stored form.
 *
 * A paragraph carrying neither an alignment nor a line spacing is written as
 * the bare array of runs it has always been, so every document already in the
 * database stays byte-identical and the published site's content hash does not
 * move — otherwise the "Live" badge would report changes to publish across the
 * whole site the moment this shipped, for content nobody had touched. Every
 * paragraph property added from here on owes the same debt: it must be absent
 * by default and it must be part of this test.
 */
export const serialiseDoc = (doc: RichDoc): string =>
  JSON.stringify(
    doc.map((paragraph) =>
      paragraph.align === undefined && paragraph.leading === undefined ? paragraph.runs : paragraph,
    ),
  );

/** Plain text with no marks — the shape every existing row is already in. */
export const docFromPlain = (plain: string): RichDoc =>
  cleanText(plain)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => ({ runs: line === "" ? [] : [{ text: line }] }));

/**
 * The plain-text projection.
 *
 * Stored alongside the document and kept in step on every write, because a
 * surprising number of things need the words without the marks: the `<h1>`
 * chosen for a wall, meta descriptions, OG cards, and the fallback when a
 * document cannot be parsed.
 */
export const docToPlain = (doc: RichDoc): string =>
  doc.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");

export const isEmptyDoc = (doc: RichDoc): boolean => docToPlain(doc).trim() === "";

/**
 * The document a copy page should render.
 *
 * Three sources in order: the rich column once she has saved one, the plain
 * column she typed before rich text existed, and the prose the site shipped
 * with. The last is why an empty field is not an empty page — see
 * src/lib/default-copy.ts.
 *
 * Converting plain copy makes every line a paragraph. The old format let a
 * single newline sit inside a paragraph and only a blank line start a new one;
 * the model has paragraphs and no soft break, so this is the honest mapping
 * rather than an exact one. It only affects copy she has not yet re-saved.
 */
export const copyDoc = (
  rich: string | null | undefined,
  plain: string,
  fallback: string,
  fonts: FontOption[] = [],
): RichDoc => {
  const stored = parseDoc(rich, plain, fonts);
  return isEmptyDoc(stored) ? docFromPlain(fallback) : stored;
};

/** Whether any run carries a mark — what tells the editor a box is truly plain. */
export const hasFormatting = (doc: RichDoc): boolean =>
  doc.some(
    (paragraph) =>
      paragraph.align !== undefined ||
      paragraph.leading !== undefined ||
      paragraph.runs.some((run) => MARK_KEYS.some((key) => run[key] !== undefined)),
  );
