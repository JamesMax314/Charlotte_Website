import { Container } from "@/components/container";
import { PortfolioCanvas } from "@/components/admin/portfolio-canvas";
import { PageSettingsPanel } from "@/components/admin/page-settings";
import {
  getAllPortfolioItems,
  getArchivedPortfolioItems,
  getWallTexts,
} from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { mergeFonts } from "@/lib/fonts";
import { getSiteFonts } from "@/lib/site-settings";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortfolioAdminPage() {
  await requireSession();
  const [items, texts, archived, settings, fonts] = await Promise.all([
    getAllPortfolioItems(),
    getWallTexts(),
    getArchivedPortfolioItems(),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  return (
    <Container className="pt-10 pb-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Home page</h1>
          <p className="text-graphite mt-1 text-sm">
            Text and work, arranged however you like. Right-click the wall to add something — or
            press and hold on a tablet.
          </p>
        </div>
      </div>

      <PageSettingsPanel
        settings={{
          gutterEnabled: settings.gutterEnabled,
          gutter: settings.gutter,
          snapEnabled: settings.snapEnabled,
          gridEnabled: settings.gridEnabled,
          gridColumns: settings.gridColumns,
          gridSnap: settings.gridSnap,
          showNamesOnHover: settings.showNamesOnHover,
          contentFadeIn: settings.contentFadeIn,
        }}
      />

      <h2 className="text-graphite mb-3 text-xs tracking-[0.18em] uppercase">The wall</h2>
      <PortfolioCanvas
        items={items}
        texts={texts}
        archived={archived}
        snapEnabled={settings.snapEnabled}
        gutter={settings.gutterEnabled ? settings.gutter : 0}
        gridEnabled={settings.gridEnabled}
        gridColumns={settings.gridColumns}
        gridSnap={settings.gridSnap}
        fonts={mergeFonts(fonts)}
      />

      <p className="text-graphite mt-4 max-w-2xl text-xs">
        This arrangement is what visitors see on a computer. On a phone the pieces stack in reading
        order — top to bottom, then left to right — because a layout composed at this width cannot
        be squeezed onto a small screen.
      </p>
    </Container>
  );
}
