"use client";

import { useEffect, useRef } from "react";
import { isWithinRevealBand, revealDelay, SETTLE_MS } from "@/lib/reveal";

/**
 * Reveals its contents as they rise into the viewport.
 *
 * Only used on the public site — the editor never fades, or the artist would
 * be arranging work she cannot see.
 *
 * The `fade-target` class ships in the server markup, but the CSS only hides it
 * under `.js-fade`, which an inline script in the site layout adds during
 * parsing. Hiding from this component instead meant the content painted once,
 * vanished, then faded — a visible flicker.
 *
 * The opening screenful is revealed by the inline script in the site layout, not
 * here — nothing can fade in while `js-fade` hides it, so leaving that to React
 * kept the wall blank for as long as the bundle took to hydrate. This component
 * owns everything below the fold, where a visitor has to scroll to reach it and
 * the bundle has long since arrived.
 *
 * This deliberately does not use IntersectionObserver. Below `md` the wall is a
 * stack thousands of pixels tall, so nearly every piece starts below the fold
 * and depended on the observer, which never delivered — the whole gallery sat
 * blank until the layout's failsafe fired. Above `md` the wall is bounded by an
 * aspect ratio and roughly one screen tall, so nearly every piece was on screen
 * at mount and revealed on a timer instead. That is the entire reason the fade
 * worked on a desktop and failed on every phone, and why a fix aimed at one
 * browser engine could never have caught it.
 */

/*
  One controller for the whole wall rather than one observer per piece: a phone
  can hold thirty-odd targets, and thirty scroll listeners is a jank budget
  spent for nothing.
*/
const waiting = new Set<HTMLElement>();
let frame = 0;
let poll = 0;
let listening = false;
let swept = false;

const show = (el: HTMLElement, delay = 0) => {
  if (!waiting.delete(el)) return;

  const paint = () => {
    el.classList.add("is-visible");
    /*
      Finish with the transition once it has run. Leaving a transform on every
      piece keeps a tall stack of large images on compositing layers that a
      phone then evicts under memory pressure, which reads as work vanishing
      and reappearing as you scroll.
    */
    window.setTimeout(() => el.classList.add("is-settled"), SETTLE_MS);
  };

  if (delay > 0) window.setTimeout(paint, delay);
  else paint();
};

const sweep = () => {
  frame = 0;
  const viewportHeight = window.innerHeight;

  for (const el of Array.from(waiting)) {
    const rect = el.getBoundingClientRect();
    if (!isWithinRevealBand(rect, viewportHeight)) continue;

    /*
      The first pass is the page arriving, so the opening screenful is
      staggered top to bottom and the wall assembles rather than snapping in.
      Everything after it is the visitor scrolling, where a delay would just
      read as lag.
    */
    show(el, swept ? 0 : revealDelay(rect.top, viewportHeight));
  }

  swept = true;
  if (waiting.size === 0) stop();
};

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(sweep);
};

const start = () => {
  if (listening) return;
  listening = true;

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  /*
    Images arriving reflow everything below them without firing a scroll event,
    so an observer-free sweep has to be told about them or the pieces under the
    fold are measured once, at the wrong place, and never again. Capture, since
    `load` on an image does not bubble.
  */
  window.addEventListener("load", schedule, true);
  poll = window.setInterval(schedule, 500);
};

const stop = () => {
  if (!listening) return;
  listening = false;

  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  window.removeEventListener("load", schedule, true);
  window.clearInterval(poll);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
};

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

    /*
      The inline script in the site layout has usually revealed the opening
      screenful already, before this bundle existed. Those pieces only need
      their transition retiring; re-revealing them would restart it.
    */
    if (el.classList.contains("is-visible")) {
      window.setTimeout(() => el.classList.add("is-settled"), SETTLE_MS);
      return;
    }

    waiting.add(el);
    start();
    schedule();

    return () => {
      waiting.delete(el);
      if (waiting.size === 0) stop();
    };
  }, []);

  return (
    <div ref={ref} className={`fade-target ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
