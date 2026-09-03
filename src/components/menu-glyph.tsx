/**
 * The hamburger, and the cross it becomes while the menu is open.
 *
 * Both are drawn, and CSS picks between them off the `<details>` element's own
 * open state — `group-open:` — rather than a React prop. That is what lets the
 * menu button be correct before the bundle arrives, or without it.
 *
 * Drawn as a line in the same weight as `InstagramGlyph`, which it sits
 * opposite in the mobile bar, and sized by its consumer in `em` so the two
 * track whatever nav size the artist has set.
 *
 * `width` and `height` are set as attributes as well as through the class, and
 * that is deliberate: an `<svg>` carrying a `viewBox` and no intrinsic size
 * collapses to nothing in WebKit inside a flex container, while Blink gives it
 * a default box. So a stylesheet that has not arrived is a glyph that is
 * missing on an iPhone and merely mis-sized on Android — one bug reported as
 * two. The attributes lose to any class that does arrive.
 */
export function MenuGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <g className="group-open:hidden">
        <line x1="3.5" y1="7" x2="20.5" y2="7" />
        <line x1="3.5" y1="12" x2="20.5" y2="12" />
        <line x1="3.5" y1="17" x2="20.5" y2="17" />
      </g>
      <g className="hidden group-open:inline">
        <line x1="5" y1="5" x2="19" y2="19" />
        <line x1="19" y1="5" x2="5" y2="19" />
      </g>
    </svg>
  );
}
