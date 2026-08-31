import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { PortfolioWall } from "@/components/portfolio-wall";
import { getPublishedPortfolio } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// this renders per request. See docs/progress.md.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [items, settings] = await Promise.all([getPublishedPortfolio(), getSiteSettings()]);

  return (
    <>
      <Container className="pt-16 pb-14 sm:pt-24">
        <Mark className="text-ink animate-stride-in h-20 w-20" />

        <div className="mt-6 grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-balance sm:text-6xl">
            {settings.homeTitle}
          </h1>
          <p className="text-graphite max-w-md text-lg leading-relaxed text-pretty">
            {settings.homeBlurb}
          </p>
        </div>
      </Container>

      <Container className="pb-16">
        <PortfolioWall items={items} />
      </Container>
    </>
  );
}
