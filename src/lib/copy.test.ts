import { describe, expect, it } from "vitest";
import { toParagraphs } from "./copy";

describe("toParagraphs", () => {
  it("returns a single paragraph unchanged", () => {
    expect(toParagraphs("Just the one.")).toEqual(["Just the one."]);
  });

  it("splits on a blank line", () => {
    expect(toParagraphs("First.\n\nSecond.")).toEqual(["First.", "Second."]);
  });

  it("treats several blank lines as one break", () => {
    expect(toParagraphs("First.\n\n\n\nSecond.")).toEqual(["First.", "Second."]);
  });

  it("keeps a single newline inside its paragraph", () => {
    // She is typing in a plain box, so Enter has to do something. Rendered
    // with whitespace-pre-line.
    expect(toParagraphs("One line\nand its neighbour.")).toEqual([
      "One line\nand its neighbour.",
    ]);
  });

  it("handles a blank line that carries whitespace", () => {
    expect(toParagraphs("First.\n   \nSecond.")).toEqual(["First.", "Second."]);
    expect(toParagraphs("First.\n\t\nSecond.")).toEqual(["First.", "Second."]);
  });

  it("normalises CRLF", () => {
    expect(toParagraphs("First.\r\n\r\nSecond.")).toEqual(["First.", "Second."]);
  });

  it("trims each paragraph", () => {
    expect(toParagraphs("  First.  \n\n  Second.  ")).toEqual(["First.", "Second."]);
  });

  it("yields nothing for empty or whitespace-only copy", () => {
    // This is the signal the pages use to fall back to the shipped prose.
    expect(toParagraphs("")).toEqual([]);
    expect(toParagraphs("   \n\n  \t ")).toEqual([]);
  });
});
