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
              I am an illustrator working in collage, drawing and digital colour. Most of my work is
              commissioned: illustrated maps, interpretive panels, editorial spreads and sequences
              that have to be read as well as looked at.
            </p>
            <p>
              A piece usually begins with research and reference, then gets built up in layers —
              drawn elements, photographed textures and typography arranged until the information
              reads in the right order.
            </p>
            <p>
              Prints of selected pieces are sold through my Etsy shop, which handles payment,
              postage and returns. For commissions, please get in touch.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
