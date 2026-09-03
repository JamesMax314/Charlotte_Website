"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { InstagramGlyph } from "./instagram-glyph";
import { MenuGlyph } from "./menu-glyph";

export interface MobileNavLink {
  href: string;
  label: string;
}

/**
 * The phone's half of the top bar: the menu button on the left, Instagram on
 * the right, and the list of pages that drops below them.
 *
 * **The menu opens without JavaScript, and that is the whole design.** It is a
 * native `<details>`, so the server's markup is already a working disclosure —
 * the browser opens and closes it whether or not the bundle ever arrives,
 * whether or not hydration completes. The first version of this was a `<button>`
 * with an `onClick`, and on a phone where hydration had not finished it was a
 * hamburger that could be seen and not pressed: the top bar is the way around
 * the site, and it must not be the first thing a slow network takes away. The
 * fade already carries this rule — presentation must not depend on hydration —
 * and navigation has the stronger claim to it.
 *
 * So everything below is enhancement, and everything the artist's visitors need
 * survives without it. `<details>` also brings its own accessibility: a summary
 * is a button with an expanded state, announced correctly, with no `aria-*` of
 * ours to keep in step.
 *
 * The panel is in the flow rather than floating — the header grows and the page
 * moves down under it, so an open menu never covers the artwork. That is also
 * why this is not a `FloatingLayer`: nothing here is portalled or positioned
 * over anything.
 *
 * Above `md` the whole thing is `display: none` and the server-rendered navs
 * take over.
 */
export function MobileNav({
  links,
  instagramUrl,
}: {
  links: MobileNavLink[];
  instagramUrl: string | null;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const close = () => {
    if (details.current) details.current.open = false;
  };

  /*
    Closed by writing to the DOM, never by React state. The element is
    uncontrolled — the browser owns `open`, because the browser is what has to
    work when nothing else does — so React must not hold a second opinion about
    it. Writing to a DOM node an effect does not own is the one thing effects
    are actually for, and it sidesteps the cascading render a state reset here
    would cost.

    Arriving anywhere closes the menu. Without the bundle this is already true
    for free: a `<Link>` with no JavaScript behind it is a plain anchor, so the
    navigation is a full page load and the new page's menu starts closed.
  */
  useEffect(close, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative w-full text-[length:var(--header-nav-size,14px)] md:hidden">
      <details ref={details} className="group w-full">
        {/*
          The summary's `display: block` and its missing marker both come from
          globals.css, for the reasons written there. It is not set to flex: a
          summary that is laid out as flex has a history of taking the
          disclosure behaviour with it in WebKit, so the flex box is a span
          inside instead. `w-fit` keeps it off the right-hand end of the line,
          where the Instagram link is.
        */}
        <summary className="w-fit cursor-pointer">
          {/*
            A 40px tap target, because the glyph alone is 22px and that is under
            any thumb's idea of one — but the glyph is aligned to the *start* of
            that box rather than centred in it, and that is not a style choice.
            Centred, the box has to have a real width or the glyph walks to the
            middle of the screen: the artist's iPhone showed exactly that, and
            the same markup was correct in Chrome, which makes it a fault that
            depends on a width utility resolving. Aligned to the start it cannot
            happen — however wide the box turns out to be, the bars stay flush
            with the content column, which is where they belong anyway.
          */}
          <span className="hover:text-accent flex h-10 w-10 items-center justify-start transition-colors">
            <MenuGlyph className="h-[1.6em] w-[1.6em] shrink-0" />
            {/* A summary announces its own expanded state, so this does not. */}
            <span className="sr-only">Menu</span>
          </span>
        </summary>

        <nav aria-label="Main" className="border-line mt-1 border-t pt-2 pb-1">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                {/*
                  `onClick` closes it for the one case the pathname cannot see:
                  a link to the page already on screen. Without JavaScript that
                  navigation is a full page load, which closes it anyway.
                */}
                <Link
                  className="hover:text-accent block py-3 transition-colors"
                  href={link.href}
                  onClick={close}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </details>

      {/*
        Outside the `<details>`, because everything inside it after the summary
        is the disclosure's content and would be hidden with the menu. Absolute
        against the wrapper, sharing the summary's 40px band so the two glyphs
        sit on one line.

        Hidden rather than pointed nowhere when the artist has not set one,
        exactly as the desktop bar's link is. Icon-only, so the accessible name
        and the new-tab warning are carried by the visually hidden text — the
        glyph itself is `aria-hidden`, or a screen reader would announce the
        link twice.
      */}
      {instagramUrl && (
        <a
          className="hover:text-accent absolute top-0 right-0 flex h-10 w-10 items-center justify-end transition-colors"
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <InstagramGlyph className="h-[1.45em] w-[1.45em] shrink-0" />
          <span className="sr-only">Instagram (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
