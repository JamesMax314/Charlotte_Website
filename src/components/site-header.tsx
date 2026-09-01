import Image from "next/image";
import Link from "next/link";
import { Container } from "./container";
import { Mark } from "./mark";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_SITE_NAME } from "@/lib/default-copy";
import { getNavPages } from "@/lib/site-pages-queries";
import { navLabel } from "@/lib/site-pages";

export async function SiteHeader() {
  const [settings, pages] = await Promise.all([getSiteSettings(), getNavPages()]);
  const name = settings.siteName || DEFAULT_SITE_NAME;

  return (
    <header className="border-line border-b">
      {/*
        Three slots, and the middle one is genuinely centred — which is why
        this is a grid above `md` rather than `justify-between`. With the brand
        and the fixed links flexing, the artist's pages would sit wherever
        those two happened to leave room, and would shift every time she
        renamed one. The equal `1fr` columns pin the centre to the centre.
      */}
      {/*
        `min-h`, not `h`. The artist sets the bar's height, but a name in a
        large face — or a nav that has wrapped to a second row on a phone —
        must push the bar taller rather than be clipped by it. The settings
        panel says so when her type has outgrown the number she chose.
      */}
      <Container className="flex min-h-[var(--header-height,76px)] flex-wrap items-center gap-x-6 gap-y-3 py-2 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          className="group mr-auto flex items-center gap-3 md:mr-0"
          aria-label={`${name}, home`}
        >
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

        {/*
          Home and the artist's own pages — the gallery's own navigation, as
          against the fixed links on the right.

          The home wall leads it rather than relying on the mark alone: a wordmark is
          only recognisable as the way back once you already know the site, and
          with pages beside it there is a row of obvious links with a
          conspicuous gap where the most-wanted one should be. It is always
          rendered, which is also what keeps the middle grid column occupied so
          the fixed links stay at the end of the bar.

          Below `md` the whole nav drops to its own full-width row, because the
          brand and the fixed links already fill a phone's width and a nav that
          has grown to five pages would otherwise squeeze them to nothing.
        */}
        <nav
          aria-label="Pages"
          className="order-last w-full md:order-none md:w-auto md:justify-self-center"
        >
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

        <nav aria-label="Main" className="md:justify-self-end">
          <ul className="flex items-center gap-6 text-[length:var(--header-nav-size,14px)]">
            <li>
              <Link className="hover:text-accent transition-colors" href="/about">
                About
              </Link>
            </li>
            <li>
              <Link className="hover:text-accent transition-colors" href="/contact">
                Contact
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
          </ul>
        </nav>
      </Container>
    </header>
  );
}
