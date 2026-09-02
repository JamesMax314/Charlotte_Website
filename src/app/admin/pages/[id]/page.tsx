import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PortfolioCanvas } from "@/components/admin/portfolio-canvas";
import { PageSettingsPanel } from "@/components/admin/page-settings";
import { SitePageForm } from "@/components/admin/site-page-form";
import { getAllPortfolioItems, getWallTexts } from "@/lib/portfolio-queries";
import { getSitePageById } from "@/lib/site-pages-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { mergeFonts } from "@/lib/fonts";
import type { WallScope } from "@/lib/portfolio";
import { navLabel } from "@/lib/site-pages";
import { getSiteFonts } from "@/lib/site-settings";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * One of the artist's own pages, composed with the same wall as the home page.
 *
 * The scope is `page`, not `piece`, and that is the whole difference: work
 * placed here is clickable and gets a page of its own, exactly as it does at
 * home. Only a piece's own page makes its contents inert.
 */
export default async function SitePageEditor({ params }: Props) {
  await requireSession();
  const { id } = await params;

  const page = await getSitePageById(id);
  if (!page) notFound();

  const scope: WallScope = { kind: "page", id };
  const [items, texts, settings, fonts] = await Promise.all([
    getAllPortfolioItems(scope),
    getWallTexts(scope),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  return (
    <Container className="pt-10 pb-20">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">{navLabel(page)}</h1>
        <p className="text-graphite mt-1 text-sm">
          One of your own pages. Right-click the wall to add images and text — or press and hold on
          a tablet. Drag its name in the bar above to move it along the top of the site.
        </p>
      </div>

      <SitePageForm page={page} />

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
        snapEnabled={settings.snapEnabled}
        gutter={settings.gutterEnabled ? settings.gutter : 0}
        gridEnabled={settings.gridEnabled}
        gridColumns={settings.gridColumns}
        gridSnap={settings.gridSnap}
        scope={scope}
        fonts={mergeFonts(fonts)}
      />

      <p className="text-graphite mt-4 max-w-2xl text-xs">
        As on the home page, this arrangement is what visitors see on a computer. On a phone the
        pieces stack in reading order — top to bottom, then left to right.
      </p>
    </Container>
  );
}
