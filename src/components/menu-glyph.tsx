/**
 * The hamburger, and the cross it becomes while the menu is open.
 *
 * Drawn as a line in the same weight as `InstagramGlyph`, which it sits
 * opposite in the mobile bar, and sized by its consumer in `em` so the two
 * track whatever nav size the artist has set. One component rather than two,
 * because the bars and the cross must stay the same weight and the same box —
 * the button must not change size when it is pressed.
 */
export function MenuGlyph({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {open ? (
        <>
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </>
      ) : (
        <>
          <line x1="3.5" y1="7" x2="20.5" y2="7" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" />
          <line x1="3.5" y1="17" x2="20.5" y2="17" />
        </>
      )}
    </svg>
  );
}
