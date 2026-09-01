import { Container } from "@/components/container";
import { PortfolioWall } from "@/components/portfolio-wall";
import { getPublishedWall, getWallTexts } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { mergeFonts } from "@/lib/fonts";
import { getSiteFonts } from "@/lib/site-settings";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// this renders per request. See docs/progress.md.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [items, texts, settings, fonts] = await Promise.all([
    getPublishedWall(),
    getWallTexts(),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  return (
    <Container className="pt-16 pb-16 sm:pt-24">
      <PortfolioWall
        items={items}
        texts={texts}
        showNamesOnHover={settings.showNamesOnHover}
        fadeIn={settings.contentFadeIn}
        fonts={mergeFonts(fonts)}
      />
    </Container>
  );
}
