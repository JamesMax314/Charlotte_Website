import Image from "next/image";
import Link from "next/link";
import { Container } from "./container";
import { Mark } from "./mark";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_SITE_NAME } from "@/lib/default-copy";

export async function SiteHeader() {
  const settings = await getSiteSettings();
  const name = settings.siteName || DEFAULT_SITE_NAME;

  return (
    <header className="border-line border-b">
      <Container className="flex items-center justify-between gap-6 py-5">
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
          <span className="font-display text-ink text-lg tracking-tight">{name}</span>
        </Link>

        <nav aria-label="Main">
          <ul className="flex items-center gap-6 text-sm">
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
            {/* Hidden rather than pointed nowhere when the artist has no shop yet. */}
            {settings.etsyShopUrl && (
              <li>
                <a
                  className="text-graphite hover:text-accent hidden transition-colors sm:inline"
                  href={settings.etsyShopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Shop
                  <span className="sr-only"> on Etsy (opens in a new tab)</span>
                </a>
              </li>
            )}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
