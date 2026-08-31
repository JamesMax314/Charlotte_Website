/**
 * A divider drawn rather than ruled — the same wandering line quality as the
 * artist's mark. Used sparingly, for section breaks only; everything else uses
 * a plain hairline so this stays the thing you notice.
 */
export function DrawnRule({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 8"
      preserveAspectRatio="none"
      className={`text-line h-2 w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0,4.2 C110,2 210,6.4 320,4.6 C430,2.7 520,6.8 640,4.1 C760,1.6 850,6.2 960,4.4 C1050,3 1130,5 1200,3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
