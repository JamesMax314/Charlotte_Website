import type { Metadata } from "next";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";

// The root layout's header and footer read site settings from D1, so this page
// cannot be prerendered without baking in stale settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "About Charlotte, and how the prints are made.",
};

export default function AboutPage() {
  return (
    <Container className="pt-16 pb-4">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <Mark className="text-ink h-24 w-24" />
        </div>

        <div className="max-w-prose">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">About</h1>

          <div className="mt-6 space-y-5 leading-relaxed text-pretty">
            <p>
              I work in ink and brush pen, mostly from life and mostly quickly. The drawings start
              as one continuous line and stop when the line stops being interesting.
            </p>
            <p>
              Prints are giclée, made on 310gsm cotton rag in editions of fifteen to forty. Each one
              is signed and numbered on the lower margin before it goes out.
            </p>
            <p>
              Everything is sold through my Etsy shop, which handles payment, postage and returns. I
              pack and post each order myself, usually within three working days.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
