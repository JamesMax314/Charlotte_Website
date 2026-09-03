/**
 * Which key presses are the studio's undo, and which belong to the browser.
 *
 * Pure, and separated from the provider that listens, because the interesting
 * half is a set of rules about where the caret is — and asserting those
 * against real elements is worth doing without a React tree in the way.
 */

/** The parts of a KeyboardEvent the rules below actually read. */
export interface ShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Cmd+Z on a Mac, Ctrl+Z everywhere else.
 *
 * Both modifiers are accepted on every platform rather than sniffing the one
 * in use. The artist works on one machine and would never press the other
 * combination, so a check costs a way for the feature to be missing on a
 * platform nobody tested it on, and buys nothing.
 */
export const isUndoShortcut = (event: ShortcutEvent): boolean =>
  event.key.toLowerCase() === "z" &&
  (event.metaKey || event.ctrlKey) &&
  !event.shiftKey &&
  !event.altKey;

/** Shift+Cmd+Z, and Ctrl+Y for the Windows habit. */
export const isRedoShortcut = (event: ShortcutEvent): boolean => {
  if (event.altKey) return false;
  const key = event.key.toLowerCase();
  if (key === "z") return (event.metaKey || event.ctrlKey) && event.shiftKey;
  // Ctrl+Y only. Cmd+Y is "go to bookmarks" on a Mac and not ours to take.
  if (key === "y") return event.ctrlKey && !event.metaKey && !event.shiftKey;
  return false;
};

/** `<input>` types that hold text a browser will undo character by character. */
const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
]);

/**
 * True when the press belongs to something other than the history.
 *
 * Two cases, with different reasons for the same answer.
 *
 * **A field the artist is typing in.** Inside a text box, an input or a
 * textarea, Cmd+Z is the browser's own character-level undo, and taking it
 * away would mean reimplementing that — including caret restoration through
 * every render of a contenteditable, which is exactly the work
 * `RichTextEditor` exists to avoid. So the history takes over only once focus
 * has left the field, where one press undoes the edit as a whole.
 *
 * **An open dialog.** A modal traps focus, so anything the history could undo
 * is behind it and out of sight — and the studio's undo is silent, so the
 * artist would get no sign that the press did anything at all. The dialogs
 * that commit on submit have nothing recorded to undo yet in any case.
 */
export const swallowsUndo = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;

  if (target.closest("dialog[open]") !== null) return true;
  const editable =
    '[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
  if (target.closest(editable) !== null) return true;

  const field = target.closest("input, textarea, select");
  if (field === null) return false;
  if (field instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(field.type.toLowerCase());
  // A textarea always, a select never — a select has no text to undo, and
  // swallowing there would make the shortcut dead while a dropdown has focus.
  return field instanceof HTMLTextAreaElement;
};
