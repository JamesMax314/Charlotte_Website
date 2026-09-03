import Image from "next/image";
import Link from "next/link";
import { Container } from "./container";
import { InstagramGlyph } from "./instagram-glyph";
import { Mark } from "./mark";
import { MobileNav, type MobileNavLink } from "./mobile-nav";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_SITE_NAME } from "@/lib/default-copy";
import { getNavPages } from "@/lib/site-pages-queries";
import { navLabel } from "@/lib/site-pages";

export async function SiteHeader() {
  const [settings, pages] = await Promise.all([getSiteSettings(), getNavPages()]);
  const name = settings.siteName || DEFAULT_SITE_NAME;

  /*
    The phone's menu is the whole bar in one list, in the order the artist
    reads her own site: the home wall, then her pages, then the shop, then
    About. Above `md` those same links are split across the two navs below —
    this is the one place the full order is stated, and the two must agree.
  */
  const mobileLinks: MobileNavLink[] = [
    { href: "/", label: "Illustration" },
    ...pages.map((page) => ({ href: `/${page.slug}`, label: navLabel(page) })),
    { href: "/shop", label: "Shop" },
    { href: "/about", label: "About" },
  ];

  return (
    <header className="border-line border-b">
      {/*
        Two bars in one, and they share no arrangement at all.

        Above `md`: three slots, and the middle one is genuinely centred —
        which is why this is a grid rather than `justify-between`. With the
        brand and the fixed links flexing, the artist's pages would sit
        wherever those two happened to leave room, and would shift every time
        she renamed one. The equal `1fr` columns pin the centre to the centre.

        Below it: a column. The brand is centred on its own line, and the menu
        button and Instagram sit at either end of the line beneath it. A phone's
        width is not enough for a brand, a nav of five pages and two fixed
        links, and the previous answer — wrapping the pages onto a third row —
        grew the bar without ever making it legible.

        The desktop navs are `hidden` below `md` rather than reflowed, and
        `MobileNav` is `hidden` above it. Both are always in the markup, so a
        crawler and a screen reader see one bar's worth of links either way.
      */}
      {/*
        `min-h`, not `h`. The artist sets the bar's height, but a name in a
        large face — or the phone's second row, or its open menu — must push
        the bar taller rather than be clipped by it. The settings panel says so
        when her type has outgrown the number she chose.
      */}
      <Container className="flex min-h-[var(--header-height,76px)] flex-col items-center gap-y-3 py-2 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-x-6">
        <Link href="/" className="group flex items-center gap-3" aria-label={`${name}, home`}>
          {settings.faviconKey ? (
            <span className="border-line block h-9 w-9 shrink-0 overflow-hidden rounded-full border transition-transform duration-300 group-hover:-rotate-6">
              {/*
                `unoptimized` is load-bearing. Without it the custom loader
                rewrites this to a `-400` derivative, which the favicon path
                deliberately never writes — so /media misses, falls through to
                its base-key branch, and reads R2 twice on the header of every
                page while looking perfectly fine.
              */}
              <Image
                src={`/media/${settings.faviconKey}`}
                alt=""
                width={72}
                height={72}
                unoptimized
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <Mark className="text-ink h-9 w-9 shrink-0 transition-transform duration-300 group-hover:-rotate-6" />
          )}
          <span className="font-display text-ink text-[length:var(--header-name-size,18px)] leading-tight tracking-tight">
            {name}
          </span>
        </Link>

        <MobileNav links={mobileLinks} instagramUrl={settings.instagramUrl || null} />

        {/*
          Home and the artist's own pages — the gallery's own navigation, as
          against the fixed links on the right.

          The home wall leads it rather than relying on the mark alone: a wordmark is
          only recognisable as the way back once you already know the site, and
          with pages beside it there is a row of obvious links with a
          conspicuous gap where the most-wanted one should be. It is always
          rendered, which is also what keeps the middle grid column occupied so
          the fixed links stay at the end of the bar.
        */}
        <nav aria-label="Pages" className="hidden md:block md:justify-self-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[length:var(--header-nav-size,14px)]">
            <li>
              <Link className="hover:text-accent transition-colors" href="/">
                Illustration
              </Link>
            </li>
            {pages.map((page) => (
              <li key={page.id}>
                <Link className="hover:text-accent transition-colors" href={`/${page.slug}`}>
                  {navLabel(page)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Main" className="hidden md:block md:justify-self-end">
          <ul className="flex items-center gap-6 text-[length:var(--header-nav-size,14px)]">
            <li>
              <Link className="hover:text-accent transition-colors" href="/about">
                About
              </Link>
            </li>
            {/*
              The shop is ours now, not a link straight out to Etsy — the
              handoff happens on the product page. The footer still carries the
              Etsy shop front (brief P-09).
            */}
            <li>
              <Link className="hover:text-accent transition-colors" href="/shop">
                Shop
              </Link>
            </li>
            {/*
              Hidden rather than pointed nowhere when the artist has not set
              one, exactly as the footer's link is. Icon-only, so the accessible
              name and the new-tab warning are carried by the visually hidden
              text — the glyph itself is `aria-hidden`, or a screen reader would
              announce the link twice.
            */}
            {settings.instagramUrl && (
              <li>
                <a
                  className="hover:text-accent flex items-center transition-colors"
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <InstagramGlyph className="h-[1.45em] w-[1.45em]" />
                  <span className="sr-only">Instagram (opens in a new tab)</span>
                </a>
              </li>
            )}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
