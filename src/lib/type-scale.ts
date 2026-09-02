/**
 * The point sizes the studio offers for type.
 *
 * A list rather than a number input, because the sizes worth having are not
 * evenly spaced: every point matters between body copy and a subhead, and
 * nothing between 96 and 144 does. It is also what lets the control be a
 * `<select>`, which on the artist's iPad is the system wheel picker.
 *
 * A leaf module on purpose. The box's size is a `cqw` in `portfolio.ts` and a
 * run's size is a multiple in `rich-text.ts`; both quote points to the artist
 * and neither should have to depend on the other to share this list.
 */

/**
 * Every point from 5 to 40, then the coarse tail.
 *
 * The tail is load-bearing rather than decorative: the home page's heading is
 * seeded at 5.2cqw, which is about 51pt, so a ladder stopping at 40 would be
 * unable to express the size the masthead is already set to — let alone the
 * larger ones `docs/claud_demands.md` asks to be able to reach.
 */
export const PT_STEPS: readonly number[] = [
  ...Array.from({ length: 36 }, (_, i) => i + 5),
  44,
  48,
  54,
  60,
  72,
  96,
  144,
];

/**
 * The steps a field can actually reach, with the current size guaranteed present.
 *
 * Two rules, and both exist because of how a native `<select>` behaves.
 *
 * Bounds filter the list rather than clamping the choice: a step the field
 * would only clamp away is a size the artist can pick and not get, which is
 * the complaint this control was built to answer. Offering fewer options is
 * the honest form of the same limit.
 *
 * And a `<select>` whose value matches no option renders *blank*. The stored
 * size is frequently off the ladder — the migrated heading's 51pt is the
 * standing example — so it is merged in rather than snapped to the nearest
 * step. Snapping would report a size the box is not set to, and re-picking it
 * would silently resize her masthead.
 */
export const ptOptions = (currentPt: number, minPt: number, maxPt: number): number[] => {
  const steps = PT_STEPS.filter((pt) => pt >= minPt && pt <= maxPt);
  if (!Number.isFinite(currentPt) || steps.includes(currentPt)) return steps;

  const at = steps.findIndex((pt) => pt > currentPt);
  return at === -1 ? [...steps, currentPt] : [...steps.slice(0, at), currentPt, ...steps.slice(at)];
};
