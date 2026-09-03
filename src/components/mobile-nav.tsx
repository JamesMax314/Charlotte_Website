"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
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
 * It renders the row *and* the panel because the two share one piece of state,
 * and the panel is in the flow rather than floating — the header grows and the
 * page moves down under it, so an open menu never covers the artwork. That is
 * also why this is not a `FloatingLayer`: nothing here is portalled, stacked or
 * positioned over anything.
 *
 * Above `md` both halves are `display: none` and the server-rendered navs take
 * over. A `<details>` element would have made this work without JavaScript, and
 * was rejected for one reason: an in-app `<Link>` is a client-side transition,
 * so the menu would stay open over the page it had just navigated to.
 */
export function MobileNav({
  links,
  instagramUrl,
}: {
  links: MobileNavLink[];
  instagramUrl: string | null;
}) {
  const panelId = useId();
  const pathname = usePathname();

  /*
    What is stored is the page the menu was opened *on*, not a boolean — so
    arriving anywhere else closes it during the render that shows the new page,
    with no effect and no second render. An effect that reset a flag when the
    path changed would paint the menu once more over the page it had just
    navigated to, which is the cascading render the lint rule is about.

    Tapping a link closes it as well, because the two cases the path cannot
    catch are a link to the page already on screen and a browser Back out of
    the menu.
  */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="flex w-full items-center justify-between text-[length:var(--header-nav-size,14px)] md:hidden">
        <button
          type="button"
          onClick={() => setOpenedOn(open ? null : pathname)}
          aria-expanded={open}
          aria-controls={panelId}
          className="hover:text-accent -m-2 flex items-center p-2 transition-colors"
        >
          <MenuGlyph open={open} className="h-[1.6em] w-[1.6em]" />
          <span className="sr-only">{open ? "Close menu" : "Menu"}</span>
        </button>

        {/*
          Hidden rather than pointed nowhere when the artist has not set one,
          exactly as the desktop bar's link is. With it gone the button simply
          keeps the left end to itself, which is what `justify-between` does
          with a single child.
        */}
        {instagramUrl && (
          <a
            className="hover:text-accent -m-2 flex items-center p-2 transition-colors"
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InstagramGlyph className="h-[1.45em] w-[1.45em]" />
            <span className="sr-only">Instagram (opens in a new tab)</span>
          </a>
        )}
      </div>

      {/*
        Kept in the tree and hidden with the attribute rather than unmounted, so
        `aria-controls` always names an element that exists. Do not add a
        `block` utility here: it has the same specificity as Preflight's
        `[hidden]` rule and comes later in the sheet, so the panel would never
        close.
      */}
      <div
        id={panelId}
        hidden={!open}
        className="border-line w-full border-t pt-2 pb-1 md:hidden"
      >
        <nav aria-label="Main">
          <ul className="text-[length:var(--header-nav-size,14px)]">
            {links.map((link) => (
              <li key={link.href}>
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
      </div>
    </>
  );
}
