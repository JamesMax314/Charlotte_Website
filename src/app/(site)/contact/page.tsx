import type { Metadata } from "next";
import { Container } from "@/components/container";
import { getSiteSettings } from "@/lib/catalogue";

// The root layout's header and footer read site settings from D1, so this page
// cannot be prerendered without baking in stale settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch about prints, commissions or exhibitions.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <Container className="pt-16 pb-4">
      <div className="max-w-prose">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Contact</h1>

        <p className="mt-6 leading-relaxed text-pretty">
          For commissions, exhibitions, or a question about a print that hasn&rsquo;t sold out yet,
          email me directly.
        </p>

        <a
          href={`mailto:${settings.contactEmail}`}
          className="bg-biro text-paper hover:bg-ink mt-8 inline-block px-5 py-3.5 text-sm transition-colors"
        >
          {settings.contactEmail}
        </a>

        <p className="text-graphite mt-8 text-sm leading-relaxed">
          Questions about an order you have already placed are fastest through Etsy messages, since
          that is where the order details live.
        </p>
      </div>
    </Container>
  );
}
