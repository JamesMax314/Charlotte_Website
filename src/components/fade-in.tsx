/**
 * Marks its contents as something the fade reveals.
 *
 * Deliberately does no work of its own — no effect, no observer, not even a
 * client component. The `fade-target` class ships in the server markup, the CSS
 * only acts on it under `.js-fade`, and the reveal itself belongs to the inline
 * script in the site layout (`src/lib/fade-script.ts`).
 *
 * Every version of this that revealed from React failed the same way: nothing
 * can fade in while `js-fade` hides it, so the wall was hostage to the bundle.
 * On a phone that meant a blank gallery for seconds, and when hydration did not
 * complete at all, pieces below the fold never appeared. Reverting to an effect
 * here — or to an IntersectionObserver — reintroduces both.
 *
 * Only used on the public site. The editor never fades, or the artist would be
 * arranging work she cannot see.
 */
export function FadeIn({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  /**
   * Applied to this element rather than a wrapper. The wall positions its
   * children directly, so an extra div between them would break the layout.
   */
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`fade-target ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
