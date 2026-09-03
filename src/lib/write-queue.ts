/**
 * A coalescing, sequencing write queue for the editor's autosaves.
 *
 * Pure and free of React and of the database, like `snap.ts` and
 * `selection.ts`, and for the same reason: typing in a browser is a poor way
 * to find out whether a debounce, a merge and an ordering rule agree with each
 * other.
 *
 * It exists because the wall's text boxes fired a server action on every
 * `input` event. Each of those actions revalidated the layout, and the layout
 * hashed the whole site — so a sentence typed at speed became fifty
 * whole-site reads, which on Cloudflare's free tier is
 * `1102 Worker exceeded resource limit`. Three separate faults were behind
 * that one symptom, and this fixes all three:
 *
 * **Rate.** Writes wait for a pause. A burst of keystrokes becomes one write.
 *
 * **Ordering.** At most one write per key is in flight, and the next is
 * assembled from everything that arrived while it was. Firing them
 * concurrently, as the canvas did, meant two updates to the same row racing —
 * and the earlier one landing second silently reverted the artist's last
 * keystrokes. That was a correctness bug hiding inside a performance one.
 *
 * **Starvation.** A trailing debounce alone never fires while the artist keeps
 * typing, so a long paragraph would sit entirely unsaved. `maxDelay` bounds
 * how long a change can wait however fast she types.
 */

export interface WriteQueueOptions<P extends object> {
  /** Quiet period before a change is sent. */
  delay: number;
  /**
   * The longest a change may wait, however continuous the typing. Measured
   * from the first unsent change rather than the last, which is what makes it
   * a ceiling rather than a second debounce.
   */
  maxDelay: number;
  send: (key: string, patch: P) => Promise<unknown>;
  onError?: (cause: unknown, key: string) => void;
  /** Called when the queue starts and stops having work outstanding. */
  onBusy?: (busy: boolean) => void;
}

export interface WriteQueue<P extends object> {
  /** Merges a patch into whatever is already waiting for that key. */
  push: (key: string, patch: P) => void;
  /** Sends everything now and resolves once it has all landed. */
  flush: () => Promise<void>;
  /** True while anything is waiting or in flight. */
  busy: () => boolean;
  /** Cancels the timer. Work already in flight is left to finish. */
  dispose: () => void;
}

export function createWriteQueue<P extends object>({
  delay,
  maxDelay,
  send,
  onError,
  onBusy,
}: WriteQueueOptions<P>): WriteQueue<P> {
  /** Merged and not yet sent, one entry per key. */
  const waiting = new Map<string, P>();
  /** One per key at most — that is the ordering guarantee. */
  const inFlight = new Map<string, Promise<void>>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** When the oldest currently-unsent change was pushed. */
  let since: number | null = null;
  let reportedBusy = false;

  const busy = () => waiting.size > 0 || inFlight.size > 0;

  const reportBusy = () => {
    const now = busy();
    if (now === reportedBusy) return;
    reportedBusy = now;
    onBusy?.(now);
  };

  const dispatch = (key: string): void => {
    const patch = waiting.get(key);
    if (patch === undefined) return;
    // Its own settlement will pick this up. Sending now is the race.
    if (inFlight.has(key)) return;

    waiting.delete(key);
    if (waiting.size === 0) since = null;

    const work: Promise<void> = send(key, patch)
      .then(() => undefined)
      .catch((cause: unknown) => {
        onError?.(cause, key);
      })
      .finally(() => {
        inFlight.delete(key);
        // Whatever arrived while that was away goes immediately: it has
        // already waited out a delay, and the queue is what was holding it.
        dispatch(key);
        reportBusy();
      });

    inFlight.set(key, work);
  };

  const dispatchAll = () => {
    timer = null;
    for (const key of [...waiting.keys()]) dispatch(key);
    reportBusy();
  };

  const arm = () => {
    if (timer !== null) clearTimeout(timer);
    /*
      The wait is the shorter of the quiet period and what is left of the
      ceiling, so continuous typing still lands a write every `maxDelay`
      rather than none at all.
    */
    const elapsed = since === null ? 0 : Date.now() - since;
    timer = setTimeout(dispatchAll, Math.max(0, Math.min(delay, maxDelay - elapsed)));
  };

  return {
    push(key, patch) {
      const merged = { ...(waiting.get(key) ?? {}), ...patch } as P;
      waiting.set(key, merged);
      if (since === null) since = Date.now();
      arm();
      reportBusy();
    },

    async flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      /*
        A loop rather than one pass: dispatching can only start the writes that
        have no sibling in flight, and awaiting those releases the rest. It
        terminates because nothing pushes while it runs — a flush happens on
        blur, on unmount and on leaving the page, none of which are moments
        the editor is still producing changes.
      */
      while (busy()) {
        for (const key of [...waiting.keys()]) dispatch(key);
        await Promise.all([...inFlight.values()]);
      }
      reportBusy();
    },

    busy,

    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
