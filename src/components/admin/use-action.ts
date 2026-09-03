"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { announceWrite } from "./write-bus";

/**
 * Runs a server action and surfaces its failure.
 *
 * Actions used to be fired with a bare `void`, which throws away rejections:
 * a failed delete or save was indistinguishable from a successful one. Every
 * admin surface routes through here instead, so a failure reaches both the
 * artist and the console rather than vanishing.
 *
 * `pending` counts outstanding work rather than tracking a single promise,
 * because these surfaces fire a write per interaction — a second toggle
 * flipped mid-save would otherwise clear the indicator while the first write
 * was still in flight.
 */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const outstanding = useRef(0);

  /**
   * `run` with the rejection left intact, for a caller that needs to know.
   *
   * The undo history is the caller that needs to know: an entry whose write
   * failed must not be treated as applied and moved onto the redo side, or
   * the shortcut ends up one step out of step with the site for the rest of
   * the session. `run` deliberately swallows, so it cannot be the path an
   * entry takes — but the artist should still see the same message she would
   * for any other failed write, which is why this reports before it rethrows
   * rather than leaving that to the history.
   */
  const track = useCallback(<T>(work: Promise<T>, what: string): Promise<T> => {
    setError(null);
    outstanding.current += 1;
    setPending(true);
    return work
      .then((value) => {
        // Tells the "Live" badge there is a new answer to fetch. Only on
        // success: a write that failed changed nothing to publish.
        announceWrite();
        // Passed through, unlike `run`: an undo entry that reverses a delete
        // needs the rows the delete gave back.
        return value;
      })
      .catch((cause: unknown) => {
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`${what} failed: ${detail}`);
        console.error(`[admin] ${what} failed`, cause);
        throw cause;
      })
      .finally(() => {
        outstanding.current -= 1;
        if (outstanding.current === 0) setPending(false);
      });
  }, []);

  const run = useCallback(
    (work: Promise<unknown>, what: string): void => {
      // Reported by `track` already; this only stops the rejection escaping as
      // an unhandled one.
      void track(work, what).catch(() => {});
    },
    [track],
  );

  return useMemo(() => ({ run, track, pending, error }), [run, track, pending, error]);
}
