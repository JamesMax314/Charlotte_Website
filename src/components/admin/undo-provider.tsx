"use client";

import { usePathname } from "next/navigation";
import { createContext, use, useEffect, useMemo, useState } from "react";
import { isRedoShortcut, isUndoShortcut, swallowsUndo } from "@/lib/undo-keys";
import { createUndoStack, type UndoEntry, type UndoStack } from "@/lib/undo-stack";

/**
 * The studio's undo history, and the keys that drive it.
 *
 * Scoped to the page the artist is on: the history is cleared whenever the
 * pathname changes, which is what the artist asked for and also what makes the
 * entries safe. An entry closes over the state setters of the surface that
 * recorded it, so an entry carried across a navigation would be reaching into
 * a component that has unmounted — it would write to the database and change
 * nothing on screen.
 *
 * A context rather than a module singleton like `write-bus.ts`, because this
 * one has to be torn down and rebuilt with the tree. The bus carries a signal
 * upward from many publishers to one subscriber and owns no state; this owns
 * all of the state and hands it downward, which is the shape a provider is for.
 */

const UndoContext = createContext<UndoStack | null>(null);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const stack = useMemo(
    () =>
      createUndoStack({
        onError: (cause, label) => {
          // Nothing on screen, by decision: the studio's undo is silent. The
          // console is the signal, as it is for `getSiteSettings`.
          console.error(`[admin] undoing "${label}" failed; history cleared`, cause);
        },
      }),
    [],
  );

  /*
    Cleared during render, not from an effect.

    A parent's effects run *after* its children's, so a clear in an effect here
    would fire after the page below has already mounted — sweeping anything
    that page recorded on the way in. Reading a changed prop and adjusting
    during render is React's own answer to that ordering, and it is exact:
    this runs before any child of the new route renders at all.

    State rather than a ref, because a ref written during render is exactly
    what `react-hooks/refs` forbids — and it is right to, since a ref carries
    no signal that anything should re-render. This is the documented shape.
  */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    stack.clear();
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const undo = isUndoShortcut(event);
      const redo = isRedoShortcut(event);
      if (!undo && !redo) return;
      if (swallowsUndo(event.target)) return;

      /*
        Only once we know it is ours. Calling this any earlier would take the
        key away from the field the artist is typing in, which is the whole
        thing `swallowsUndo` is there to prevent.
      */
      event.preventDefault();
      void (undo ? stack.undo() : stack.redo());
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stack]);

  return <UndoContext value={stack}>{children}</UndoContext>;
}

/**
 * Records an action so the shortcut can reverse it.
 *
 * Throws without a provider rather than degrading to a no-op. A surface that
 * silently stops recording is a shortcut that quietly does nothing, which is
 * the one failure the artist cannot tell apart from "there was nothing to
 * undo" — and every admin surface is inside the layout that mounts this.
 */
export function useUndo(): { record: (entry: UndoEntry) => void } {
  const stack = use(UndoContext);
  if (stack === null) {
    throw new Error("useUndo must be used inside <UndoProvider> — see the admin layout.");
  }
  return useMemo(() => ({ record: stack.record }), [stack]);
}
