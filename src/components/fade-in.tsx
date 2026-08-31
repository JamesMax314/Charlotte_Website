"use client";

import { useEffect, useRef } from "react";

/**
 * Reveals its contents once they scroll into view.
 *
 * Only used on the public site — the editor never fades, or the artist would
 * be arranging things she cannot see.
 *
 * The hidden state is applied by this component rather than baked into the
 * markup. If the class were in the server HTML and the script then failed, the
 * page would be permanently blank; the CSS also carries a `prefers-reduced-
 * motion` and a `<noscript>` escape for the same reason.
 */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Older browsers get the content, just not the effect.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    el.classList.add("fade-target");

    /*
      Lock in the hidden state before anything can reveal it.

      Reading the computed style forces a style recalculation, so `opacity: 0`
      becomes the value a transition starts from. Without it an element already
      on screen goes from class-added to revealed inside one frame, the browser
      only ever paints the finished state, and the piece appears instantly
      instead of fading.
    */
    void getComputedStyle(el).opacity;

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

    // Observe on the next frame, so the hidden state has been painted once and
    // pieces already in view fade in on load rather than snapping into place.
    const frame = requestAnimationFrame(() => observer.observe(el));

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
