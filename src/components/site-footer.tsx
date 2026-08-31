import Link from "next/link";
import { Container } from "./container";
import { DrawnRule } from "./drawn-rule";
import { Mark } from "./mark";
import { getSiteSettings } from "@/lib/catalogue";

export async function SiteFooter() {
  const settings = await getSiteSettings();

  return (
    <footer className="mt-24">
      <Container>
        <DrawnRule />
      </Container>

      <Container className="flex flex-col gap-8 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Mark className="text-graphite h-8 w-8 shrink-0" />
          <p className="text-graphite max-w-xs text-sm leading-relaxed">
            Commissions welcome. Prints of selected work are sold through Etsy, which handles
            payment, postage and returns.
          </p>
        </div>

        <nav aria-label="Footer">
          <ul className="text-graphite flex flex-col gap-2 text-sm sm:items-end">
            <li>
              <a
                className="hover:text-accent transition-colors"
                href={settings.etsyShopUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Etsy shop
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a
                className="hover:text-accent transition-colors"
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <Link className="hover:text-accent transition-colors" href="/privacy">
                Privacy
              </Link>
            </li>
            <li className="pt-2">© {new Date().getFullYear()} Charlotte Wilkinson</li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
