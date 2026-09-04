/**
 * The wall's copy/paste clipboard.
 *
 * A factory, like `createUndoStack`, so it can be tested in isolation — but
 * one instance of it is a module singleton, and that half is deliberate. The
 * undo history is cleared on every navigation because its entries close over
 * state that is about to unmount; a copied selection is nothing but a set of
 * ids, with nothing in it that can go stale, and the artist expects it to
 * survive walking from one page to another to paste it there. A plain module
 * value does exactly that within one tab and needs no code to arrange it — it
 * is simply gone on a reload, because the module is loaded fresh from
 * nothing.
 */

export interface WallClipboard {
  items: readonly string[];
  texts: readonly string[];
}

export interface WallClipboardStore {
  /** Replaces the clipboard and resets the paste offset. */
  copy: (items: readonly string[], texts: readonly string[]) => void;
  /** The current clipboard, or null when nothing has been copied this session. */
  read: () => WallClipboard | null;
  /**
   * Advances the paste offset and returns the count to place this paste at.
   *
   * Called once per paste, never on copy: pressing paste twice in a row
   * should stagger the two copies so the second does not land invisibly on
   * top of the first, exactly as it would in any other editor.
   */
  nextPasteOffset: () => number;
}

export const createWallClipboardStore = (): WallClipboardStore => {
  let clipboard: (WallClipboard & { pastes: number }) | null = null;

  return {
    copy(items, texts) {
      if (items.length === 0 && texts.length === 0) return;
      clipboard = { items, texts, pastes: 0 };
    },
    read: () => (clipboard === null ? null : { items: clipboard.items, texts: clipboard.texts }),
    nextPasteOffset: () => {
      if (clipboard === null) return 1;
      clipboard.pastes += 1;
      return clipboard.pastes;
    },
  };
};

/** The studio's one clipboard, shared by every wall. See the note above. */
export const wallClipboard: WallClipboardStore = createWallClipboardStore();
