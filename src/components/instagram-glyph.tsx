/**
 * The Instagram glyph, drawn as a line rather than filled so it reads as one of
 * the site's own marks beside the header's type. Inherits currentColor like
 * `Mark` does, and is sized by its consumer in `em` so it tracks whatever nav
 * size the artist has set rather than drifting out of scale with the words.
 */
export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="18" height="18" rx="5.4" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
