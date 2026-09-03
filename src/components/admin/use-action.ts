"use client";

import { useCallback, useRef, useState } from "react";
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

  const run = useCallback((work: Promise<unknown>, what: string) => {
    setError(null);
    outstanding.current += 1;
    setPending(true);
    void work
      .then(() => {
        // Tells the "Live" badge there is a new answer to fetch. Only on
        // success: a write that failed changed nothing to publish.
        announceWrite();
      })
      .catch((cause: unknown) => {
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`${what} failed: ${detail}`);
        console.error(`[admin] ${what} failed`, cause);
      })
      .finally(() => {
        outstanding.current -= 1;
        if (outstanding.current === 0) setPending(false);
      });
  }, []);

  return { run, pending, error };
}
