"use client";

import { useEffect, useRef } from "react";
import { isOnScreenAtLoad, revealDelay } from "@/lib/reveal";

/**
 * Reveals its contents: on a timer for pieces already on screen at load, and
 * on scroll for everything below the fold.
 *
 * Only used on the public site — the editor never fades, or the artist would
 * be arranging work she cannot see.
 *
 * The `fade-target` class ships in the server markup, but the CSS only hides it
 * under `.js-fade`, which an inline script in the site layout adds during
 * parsing. Hiding from this component instead meant the content painted once,
 * vanished, then faded — a visible flicker.
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Older browsers get the content, just not the effect.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const rect = el.getBoundingClientRect();

    /*
      An observer is the wrong tool for anything already on screen: it reports
      the intersection as soon as it starts watching, so the reveal lands in
      the same frame as the hidden state and there is nothing to transition
      from. Those pieces get a timer instead, staggered by how far down they
      sit so the wall assembles from the top.
    */
    if (isOnScreenAtLoad(rect, window.innerHeight)) {
      const timer = setTimeout(
        () => el.classList.add("is-visible"),
        revealDelay(rect.top, window.innerHeight),
      );
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          // Fades once. Re-hiding on scroll back up is distracting, and it
          // would keep the observer alive for the life of the page.
          observer.unobserve(entry.target);
        }
      },
      // A little short of the fold, so a piece is already arriving as it
      // enters rather than popping in after it is fully visible.
      { rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`fade-target ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
