"use client";

/**
 * A nudge, in the browser, that some admin write has landed.
 *
 * The studio's "Live" badge used to be a prop: the layout hashed the whole
 * site on every render, so any action that revalidated the layout refreshed
 * the badge for free. That refresh was never free — it was the most expensive
 * read in the codebase running on every keystroke — so the badge now asks for
 * its own answer, and this is how it learns there is a new one to ask for.
 *
 * Deliberately not a context. The publisher is `useAction`, which every admin
 * surface already routes its writes through, and the only subscriber is a
 * component in the layout above all of them — so a provider would have to wrap
 * the tree purely to carry a signal in the wrong direction.
 *
 * It carries no payload. "Something changed, go and look" is all a listener
 * needs, and a payload would be a second description of the site's state that
 * could disagree with the hash.
 */

const listeners = new Set<() => void>();

/** Called after any admin write succeeds. */
export const announceWrite = (): void => {
  for (const listener of listeners) listener();
};

/** Returns its own unsubscribe, for an effect's cleanup. */
export const onWrite = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
