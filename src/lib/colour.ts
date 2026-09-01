/**
 * Colour arithmetic for the artist-chosen highlight.
 *
 * Deliberately free of any React or database import: the settings UI is a
 * client component and needs the same maths the server uses to emit the token.
 */

/** The two ground tones from globals.css, as literals. */
export const PAPER = "#fbfbf9";
export const INK = "#101010";
export const DEFAULT_ACCENT = "#9a5b33";

const SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG = /^#?([0-9a-f]{6})$/i;

/**
 * Parses a hex colour, or returns null.
 *
 * Null is the only "invalid" signal, because the result is interpolated into a
 * stylesheet: a value that is not exactly six hex digits must never reach the
 * `<style>` block, whatever it looks like.
 */
export const normaliseHex = (input: string): string | null => {
  const trimmed = input.trim();

  const short = SHORT.exec(trimmed);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();

  const long = LONG.exec(trimmed);
  return long ? `#${long[1]}`.toLowerCase() : null;
};

const channel = (value: number): number => {
  const sRGB = value / 255;
  return sRGB <= 0.03928 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.2 relative luminance. Assumes a valid six-digit hex. */
export const relativeLuminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = channel((value >> 16) & 0xff);
  const g = channel((value >> 8) & 0xff);
  const b = channel(value & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.2 contrast ratio, 1 to 21. Order-independent. */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
};

/**
 * The readable foreground for a surface painted in `background`.
 *
 * Compares the two real tokens rather than thresholding luminance at 0.5:
 * `--paper` is #fbfbf9 and `--ink` is #101010, not white and black, so a naive
 * threshold picks the wrong side for mid-tones near the crossover.
 */
export const readableInk = (background: string): string =>
  contrastRatio(background, PAPER) >= contrastRatio(background, INK) ? PAPER : INK;

export interface AccentVerdict {
  /** The foreground a button painted in this accent should use. */
  ink: string;
  /** Contrast of the accent against paper — how it reads as text and as a focus ring. */
  onPaper: number;
  level: "ok" | "faint" | "invisible";
}

/**
 * Both halves of the contrast guard.
 *
 * `ink` is derived, so a badly chosen accent can never produce unreadable
 * button text. `onPaper` is the half the derivation cannot fix: the accent is
 * also used as link text and as the focus outline, where it sits on paper and
 * nothing can be swapped underneath it.
 *
 * This warns; it does not block. A pale accent used only as a large button
 * surface is legitimate, and refusing the artist's colour is how a settings
 * page stops being used.
 */
export const judgeAccent = (accent: string): AccentVerdict => {
  const onPaper = contrastRatio(accent, PAPER);
  return {
    ink: readableInk(accent),
    onPaper,
    level: onPaper >= 4.5 ? "ok" : onPaper >= 3 ? "faint" : "invisible",
  };
};
