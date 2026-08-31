import Link from "next/link";
import { Container } from "./container";
import { Mark } from "./mark";
import { getSiteSettings } from "@/lib/catalogue";

export async function SiteHeader() {
  const settings = await getSiteSettings();

  return (
    <header className="border-line border-b">
      <Container className="flex items-center justify-between gap-6 py-5">
        <Link
          href="/"
          className="group flex items-center gap-3"
          aria-label="Charlotte Wilkinson, home"
        >
          <Mark className="text-ink h-9 w-9 shrink-0 transition-transform duration-300 group-hover:-rotate-6" />
          <span className="font-display text-ink text-lg tracking-tight">Charlotte Wilkinson</span>
        </Link>

        <nav aria-label="Main">
          <ul className="flex items-center gap-6 text-sm">
            <li>
              <Link className="hover:text-accent transition-colors" href="/work">
                Work
              </Link>
            </li>
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
          </ul>
        </nav>
      </Container>
    </header>
  );
}
