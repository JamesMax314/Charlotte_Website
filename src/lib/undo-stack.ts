/**
 * The studio's undo history.
 *
 * Pure and free of React and of the database, like `write-queue.ts` and
 * `selection.ts`, and for the same reason: ordering, re-entrancy and failure
 * are three things a browser is a poor place to find out you got wrong.
 *
 * An entry is a pair of thunks rather than a description of a change. The
 * admin has no single shape for "an action" — a drag is a layout patch, a
 * delete is a set of rows to put back, a settings toggle is one column — and
 * inventing a common representation would mean every surface encoding its
 * changes into it and the stack decoding them again. A closure recorded where
 * the action is fired already knows how to reverse itself, and it stays beside
 * the code it mirrors, where a change to one is visible against the other.
 *
 * Three behaviours here are load-bearing and none is obvious:
 *
 * **Serialised.** Every entry runs a server action, so two quick presses of
 * the shortcut are two writes that must not overlap. This is the ordering rule
 * `write-queue.ts` learned the hard way: concurrent updates to one row let the
 * earlier land second, and the artist watches her undo re-apply itself.
 *
 * **Re-entrancy is suppressed.** An entry's `undo` puts the surface back
 * through the same code path the artist's own gesture takes, and that path
 * records. Without the guard, undoing pushes a fresh entry — so the stack
 * grows as it is consumed and the shortcut toggles between two states forever.
 * Guarding centrally rather than at each call site is deliberate: there are
 * dozens of the latter and one of the former.
 *
 * **A failure clears everything.** The stack's whole claim is that its entries
 * describe reversible steps back from the state on screen. If one of them
 * cannot be applied, that claim is false for every entry beneath it too — they
 * were recorded against a state the site is no longer in. Dropping only the
 * failed entry keeps a history that will do something confident and wrong.
 */

export interface UndoEntry {
  /** For the console, when an entry fails. Never shown to the artist. */
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

export interface UndoStack {
  /** Adds an entry, and drops any redo history — the standard branch rule. */
  record: (entry: UndoEntry) => void;
  /** Resolves true if an entry was applied, false if there was nothing to do. */
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  /** Forgets everything. Called on navigation, and after a failure. */
  clear: () => void;
  /** Counts, for tests and for anything that wants to disable a control. */
  depth: () => { undo: number; redo: number };
}

export interface UndoStackOptions {
  /**
   * How many entries to keep. A cap rather than unbounded because an entry
   * closes over the state it restores — a group move holds a position per
   * element — and a long session on a big wall would otherwise hold every
   * arrangement it ever had.
   */
  limit?: number;
  onError?: (cause: unknown, label: string) => void;
}

export const UNDO_LIMIT = 100;

export function createUndoStack({ limit = UNDO_LIMIT, onError }: UndoStackOptions = {}): UndoStack {
  let past: UndoEntry[] = [];
  let future: UndoEntry[] = [];
  /** True while an entry is being applied; see the re-entrancy note above. */
  let applying = false;
  /** Every application joins this chain, which is what serialises them. */
  let chain: Promise<unknown> = Promise.resolve();
  /**
   * Bumped by `clear`. An entry that was in flight when the artist navigated
   * away belongs to a history that no longer exists, so its landing must not
   * put it back onto the empty stack that replaced it.
   */
  let generation = 0;

  const apply = (direction: "undo" | "redo"): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const entry = (direction === "undo" ? past : future).pop();
      if (entry === undefined) return false;
      const startedIn = generation;

      applying = true;
      try {
        await (direction === "undo" ? entry.undo() : entry.redo());
        if (generation === startedIn) (direction === "undo" ? future : past).push(entry);
        return true;
      } catch (cause) {
        past = [];
        future = [];
        onError?.(cause, entry.label);
        return false;
      } finally {
        applying = false;
      }
    };

    /*
      The chain carries the result out, but never carries a rejection: `run`
      settles either way, so a caller awaiting this cannot poison the chain for
      whatever is queued behind it.
    */
    const next = chain.then(run, run);
    chain = next;
    return next;
  };

  return {
    record(entry) {
      if (applying) return;
      past.push(entry);
      if (past.length > limit) past.shift();
      future = [];
    },

    undo: () => apply("undo"),
    redo: () => apply("redo"),

    clear() {
      past = [];
      future = [];
      generation += 1;
    },

    depth: () => ({ undo: past.length, redo: future.length }),
  };
}
