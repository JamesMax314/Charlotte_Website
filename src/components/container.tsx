/**
 * The content column: 90% of the viewport, centred.
 *
 * The 5% either side replaces horizontal padding — about 20px of gutter on a
 * phone. Callers may still cap it with their own `max-w-*`, which wins over
 * the 90%.
 */
export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-[90%] ${className}`}>{children}</div>;
}
