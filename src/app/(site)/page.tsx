import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { PortfolioWall } from "@/components/portfolio-wall";
import { getPublishedPortfolio, getWallTexts } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// this renders per request. See docs/progress.md.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [items, texts, settings] = await Promise.all([
    getPublishedPortfolio(),
    getWallTexts(),
    getSiteSettings(),
  ]);

  return (
    <>
      <Container className="pt-16 pb-14 sm:pt-24">
        <Mark className="text-ink animate-stride-in h-20 w-20" />
      </Container>

      <Container className="pb-16">
        <PortfolioWall items={items} texts={texts} showNamesOnHover={settings.showNamesOnHover} />
      </Container>
    </>
  );
}
