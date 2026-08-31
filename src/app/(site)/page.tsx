import { Container } from "@/components/container";
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
    <Container className="pt-16 pb-16 sm:pt-24">
      <PortfolioWall items={items} texts={texts} showNamesOnHover={settings.showNamesOnHover} />
    </Container>
  );
}
