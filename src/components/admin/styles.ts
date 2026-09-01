/**
 * The handful of class strings the admin repeats.
 *
 * There is no design-system layer here and this is not the start of one — it
 * exists because the same three strings were about to be copy-pasted a third
 * and fourth time.
 *
 * `hover:text-paper` on the primary button is load-bearing rather than
 * decorative: the button's foreground is derived from the artist's highlight
 * colour, and it switches to an ink background on hover. With a light
 * highlight `--accent-ink` resolves to ink, so without the override the label
 * would vanish exactly when the pointer reached it.
 */

export const FIELD =
  "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

export const PRIMARY_BUTTON =
  "bg-accent text-accent-ink hover:bg-ink hover:text-paper px-5 py-3 text-sm transition-colors disabled:opacity-60";

export const SECONDARY_BUTTON =
  "border-line hover:border-ink border px-4 py-2 text-sm transition-colors disabled:opacity-60";
