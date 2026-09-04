import { describe, expect, it } from "vitest";
import { createWallClipboardStore } from "./wall-clipboard";

describe("wall clipboard", () => {
  it("starts empty", () => {
    const clipboard = createWallClipboardStore();
    expect(clipboard.read()).toBeNull();
  });

  it("holds what was copied", () => {
    const clipboard = createWallClipboardStore();
    clipboard.copy(["item-1"], ["text-1", "text-2"]);
    expect(clipboard.read()).toEqual({ items: ["item-1"], texts: ["text-1", "text-2"] });
  });

  it("ignores a copy of nothing, leaving the previous clipboard in place", () => {
    const clipboard = createWallClipboardStore();
    clipboard.copy(["item-1"], []);
    clipboard.copy([], []);
    expect(clipboard.read()).toEqual({ items: ["item-1"], texts: [] });
  });

  it("counts pastes from one and keeps counting across repeated presses", () => {
    const clipboard = createWallClipboardStore();
    clipboard.copy(["item-1"], []);
    expect(clipboard.nextPasteOffset()).toBe(1);
    expect(clipboard.nextPasteOffset()).toBe(2);
    expect(clipboard.nextPasteOffset()).toBe(3);
  });

  it("resets the paste count on a fresh copy", () => {
    const clipboard = createWallClipboardStore();
    clipboard.copy(["item-1"], []);
    clipboard.nextPasteOffset();
    clipboard.nextPasteOffset();

    clipboard.copy(["item-2"], []);
    expect(clipboard.nextPasteOffset()).toBe(1);
  });

  it("returns 1 from nextPasteOffset when nothing has been copied", () => {
    const clipboard = createWallClipboardStore();
    expect(clipboard.nextPasteOffset()).toBe(1);
  });
});
