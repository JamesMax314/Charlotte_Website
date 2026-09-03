import { describe, expect, it } from "vitest";
import { isRedoShortcut, isUndoShortcut, swallowsUndo } from "./undo-keys";

const press = (
  key: string,
  modifiers: Partial<Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>> = {},
) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("isUndoShortcut", () => {
  it("accepts Cmd+Z and Ctrl+Z", () => {
    expect(isUndoShortcut(press("z", { metaKey: true }))).toBe(true);
    expect(isUndoShortcut(press("z", { ctrlKey: true }))).toBe(true);
  });

  it("accepts the uppercase key a modifier can produce", () => {
    expect(isUndoShortcut(press("Z", { metaKey: true }))).toBe(true);
  });

  it("rejects Z on its own, and with the wrong modifiers", () => {
    expect(isUndoShortcut(press("z"))).toBe(false);
    expect(isUndoShortcut(press("z", { metaKey: true, shiftKey: true }))).toBe(false);
    expect(isUndoShortcut(press("z", { metaKey: true, altKey: true }))).toBe(false);
  });
});

describe("isRedoShortcut", () => {
  it("accepts Shift+Cmd+Z and Shift+Ctrl+Z", () => {
    expect(isRedoShortcut(press("z", { metaKey: true, shiftKey: true }))).toBe(true);
    expect(isRedoShortcut(press("z", { ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it("accepts Ctrl+Y for the Windows habit", () => {
    expect(isRedoShortcut(press("y", { ctrlKey: true }))).toBe(true);
  });

  // Cmd+Y opens bookmarks on a Mac, and is not ours to take.
  it("leaves Cmd+Y alone", () => {
    expect(isRedoShortcut(press("y", { metaKey: true }))).toBe(false);
  });

  it("does not also match plain undo", () => {
    expect(isRedoShortcut(press("z", { metaKey: true }))).toBe(false);
  });
});

describe("swallowsUndo", () => {
  const mount = (html: string): HTMLElement => {
    document.body.innerHTML = html;
    return document.body.firstElementChild as HTMLElement;
  };

  it("leaves plain elements to the history", () => {
    expect(swallowsUndo(mount("<div><button>Delete</button></div>"))).toBe(false);
  });

  it("returns false for a target that is not an element", () => {
    expect(swallowsUndo(null)).toBe(false);
    expect(swallowsUndo(window)).toBe(false);
  });

  /*
    Inside a text box the browser's own character-level undo is what the artist
    wants, and reimplementing it would mean owning caret restoration through
    every render of the contenteditable.
  */
  it("yields to the browser inside a rich text box", () => {
    const box = mount('<div contenteditable="true"><p><span>word</span></p></div>');
    expect(swallowsUndo(box)).toBe(true);
    expect(swallowsUndo(box.querySelector("span"))).toBe(true);
  });

  it("yields inside text inputs and textareas", () => {
    expect(swallowsUndo(mount('<input type="text" />'))).toBe(true);
    expect(swallowsUndo(mount("<input />"))).toBe(true);
    expect(swallowsUndo(mount("<textarea></textarea>"))).toBe(true);
  });

  // These hold no text to undo, so swallowing would make the shortcut dead
  // for no gain — the colour picker and the header sliders are both here.
  it("does not yield for inputs with nothing to type in", () => {
    expect(swallowsUndo(mount('<input type="range" />'))).toBe(false);
    expect(swallowsUndo(mount('<input type="color" />'))).toBe(false);
    expect(swallowsUndo(mount('<input type="checkbox" />'))).toBe(false);
    expect(swallowsUndo(mount("<select><option>a</option></select>"))).toBe(false);
  });

  /*
    A modal traps focus, so whatever the history would undo is behind it and
    out of sight — and the studio's undo is silent, so the press would look
    like nothing at all.
  */
  it("yields anywhere inside an open dialog", () => {
    const dialog = mount("<dialog open><button>Delete</button></dialog>");
    expect(swallowsUndo(dialog.querySelector("button"))).toBe(true);
  });

  it("does not yield inside a dialog that is closed", () => {
    const dialog = mount("<dialog><button>Delete</button></dialog>");
    expect(swallowsUndo(dialog.querySelector("button"))).toBe(false);
  });
});
