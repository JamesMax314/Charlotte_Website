import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  DEFAULT_ACCENT,
  INK,
  judgeAccent,
  normaliseHex,
  PAPER,
  readableInk,
  relativeLuminance,
} from "./colour";

describe("normaliseHex", () => {
  it("expands the three-digit form", () => {
    expect(normaliseHex("#ABC")).toBe("#aabbcc");
    expect(normaliseHex("abc")).toBe("#aabbcc");
  });

  it("lowercases and keeps the six-digit form", () => {
    expect(normaliseHex("#9A5B33")).toBe("#9a5b33");
    expect(normaliseHex("  #9a5b33  ")).toBe("#9a5b33");
  });

  it("rejects anything that is not a hex colour", () => {
    expect(normaliseHex("red")).toBeNull();
    expect(normaliseHex("")).toBeNull();
    expect(normaliseHex("#12345")).toBeNull();
    expect(normaliseHex("#1234567")).toBeNull();
  });

  it("rejects a value that would break out of the style block", () => {
    // The result is interpolated into `:root{--accent:…}` in every page.
    expect(normaliseHex("#abc; } body { display: none }")).toBeNull();
    expect(normaliseHex("#aabbcc;")).toBeNull();
    expect(normaliseHex("var(--x)")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("spans the full range", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("weights green above red above blue", () => {
    const red = relativeLuminance("#ff0000");
    const green = relativeLuminance("#00ff00");
    const blue = relativeLuminance("#0000ff");
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black against white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("is 1 for a colour against itself", () => {
    expect(contrastRatio(DEFAULT_ACCENT, DEFAULT_ACCENT)).toBeCloseTo(1, 5);
  });

  it("does not depend on the order of its arguments", () => {
    expect(contrastRatio(INK, PAPER)).toBeCloseTo(contrastRatio(PAPER, INK), 10);
  });

  it("separates the two ground tones by nearly the full range", () => {
    expect(contrastRatio(INK, PAPER)).toBeGreaterThan(18);
  });
});

describe("readableInk", () => {
  it("puts paper on the default accent", () => {
    expect(readableInk(DEFAULT_ACCENT)).toBe(PAPER);
  });

  it("puts ink on a light surface", () => {
    expect(readableInk("#ffff00")).toBe(INK);
    expect(readableInk("#ffffff")).toBe(INK);
    expect(readableInk("#f2f1ec")).toBe(INK);
  });

  it("puts paper on a dark surface", () => {
    expect(readableInk("#101010")).toBe(PAPER);
    expect(readableInk("#2140d6")).toBe(PAPER);
  });

  it("always picks the higher-contrast of the two real tokens", () => {
    // Not a luminance threshold at 0.5: paper is #fbfbf9 and ink is #101010,
    // so the crossover does not sit where a naive test would put it.
    for (const hex of ["#777777", "#808080", "#8a8a8a", "#949494"]) {
      const chosen = readableInk(hex);
      const other = chosen === PAPER ? INK : PAPER;
      expect(contrastRatio(hex, chosen)).toBeGreaterThanOrEqual(contrastRatio(hex, other));
    }
  });
});

describe("judgeAccent", () => {
  it("passes the default accent", () => {
    const verdict = judgeAccent(DEFAULT_ACCENT);
    expect(verdict.level).toBe("ok");
    expect(verdict.ink).toBe(PAPER);
  });

  it("flags a colour that is unreadable as text on paper", () => {
    // Yellow makes a usable button surface and an invisible link. This is the
    // half of the guard that deriving a foreground cannot fix.
    const verdict = judgeAccent("#ffff00");
    expect(verdict.level).toBe("invisible");
    expect(verdict.ink).toBe(INK);
  });

  it("puts the site's own graphite comfortably in the ok band", () => {
    expect(judgeAccent("#6d6a66").level).toBe("ok");
  });

  it("flags the middle band as faint rather than failing it", () => {
    const verdict = judgeAccent("#8a8a8a");
    expect(verdict.level).toBe("faint");
    expect(verdict.onPaper).toBeGreaterThanOrEqual(3);
    expect(verdict.onPaper).toBeLessThan(4.5);
  });
});
