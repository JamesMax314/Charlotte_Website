import type { Metadata } from "next";
import { Container } from "@/components/container";
import { getSiteSettings } from "@/lib/catalogue";
import { toParagraphs } from "@/lib/copy";
import { DEFAULT_CONTACT_COPY } from "@/lib/default-copy";

// The root layout's header and footer read site settings from D1, so this page
// cannot be prerendered without baking in stale settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch about prints, commissions or exhibitions.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  const written = toParagraphs(settings.contactCopy);
  const body = written.length > 0 ? written : toParagraphs(DEFAULT_CONTACT_COPY);

  return (
    <Container>
      <div className="max-w-prose">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Contact</h1>

        <div className="mt-6 space-y-5 leading-relaxed text-pretty">
          {body.map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>

        {/* No address, no button: better than a mailto: that goes nowhere. */}
        {settings.contactEmail && (
          <a
            href={`mailto:${settings.contactEmail}`}
            className="bg-accent text-accent-ink hover:bg-ink hover:text-paper mt-8 inline-block px-5 py-3.5 text-sm transition-colors"
          >
            {settings.contactEmail}
          </a>
        )}

        {settings.etsyShopUrl && (
          <p className="text-graphite mt-8 text-sm leading-relaxed">
            Questions about an order you have already placed are fastest through Etsy messages,
            since that is where the order details live.
          </p>
        )}
      </div>
    </Container>
  );
}
