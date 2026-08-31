import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/container";
import { DrawnRule } from "@/components/drawn-rule";
import { Mark } from "@/components/mark";
import { ArtworkGrid } from "@/components/artwork-grid";
import { getFeaturedArtworks } from "@/lib/catalogue";

export default async function HomePage() {
  const featured = await getFeaturedArtworks();
  const [hero, ...rest] = featured;

  return (
    <>
      <Container className="pt-16 pb-14 sm:pt-24">
        <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Mark className="text-ink animate-stride-in h-20 w-20" />
            <h1 className="font-display mt-6 text-5xl leading-[0.95] tracking-tight sm:text-7xl">
              Drawings,
              <br />
              printed small.
            </h1>
          </div>

          <p className="text-graphite max-w-md text-lg leading-relaxed text-pretty">
            I draw people going about things — walking, swimming, standing at windows. Editions are
            short, usually under forty, and every print is sold through my Etsy shop.
          </p>
        </div>
      </Container>

      {hero && (
        <Container className="pb-16">
          <Link href={`/work/${hero.slug}`} className="group block">
            <div className="bg-paper-sunk border-line flex justify-center overflow-hidden border">
              <Image
                src={hero.images[0].src}
                alt={hero.images[0].alt}
                width={hero.images[0].width}
                height={hero.images[0].height}
                priority
                sizes="(min-width: 1280px) 1152px, 100vw"
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 className="font-display group-hover:text-biro text-xl tracking-tight transition-colors">
                {hero.title}
              </h2>
              <p className="text-graphite text-sm">
                {hero.medium} · {hero.year}
              </p>
            </div>
          </Link>
        </Container>
      )}

      <Container>
        <DrawnRule />
      </Container>

      <Container className="pt-14">
        <h2 className="text-graphite mb-10 text-xs tracking-[0.18em] uppercase">Selected work</h2>
        <ArtworkGrid artworks={rest} />
        <Link
          href="/work"
          className="hover:text-biro font-display inline-block text-lg tracking-tight underline decoration-1 underline-offset-[6px] transition-colors"
        >
          See everything
        </Link>
      </Container>
    </>
  );
}

// D1 is unreachable during `next build` (no binding outside the Worker), so
// these render per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";
