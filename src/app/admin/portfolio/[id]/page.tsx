import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PortfolioCanvas } from "@/components/admin/portfolio-canvas";
import { PageSettingsPanel } from "@/components/admin/page-settings";
import { getAllPortfolioItems, getPortfolioItemById, getWallTexts } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { mergeFonts } from "@/lib/fonts";
import { getSiteFonts } from "@/lib/site-settings";
import { requireSession } from "@/lib/auth";
import type { WallScope } from "@/lib/portfolio";
import { getSitePageById } from "@/lib/site-pages-queries";
import { navLabel } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * A piece's own page, edited with the same wall as the home page.
 *
 * Elements added here are inert on the site: they compose this page rather
 * than linking anywhere further.
 */
export default async function PortfolioItemPageEditor({ params }: Props) {
  await requireSession();
  const { id } = await params;

  const item = await getPortfolioItemById(id);
  if (!item) notFound();

  const scope: WallScope = { kind: "piece", id };
  const [items, texts, settings, fonts, shownOn] = await Promise.all([
    getAllPortfolioItems(scope),
    getWallTexts(scope),
    getSiteSettings(),
    getSiteFonts(),
    // Which wall this piece sits on, so the way back is the way in.
    item.pageId ? getSitePageById(item.pageId) : undefined,
  ]);

  /*
    Unlike the public page, a draft is still followed here: the studio's job is
    to take the artist back to the wall she was arranging, and she can reach a
    draft page perfectly well.
  */
  const back = shownOn
    ? { href: `/admin/pages/${shownOn.id}`, label: navLabel(shownOn) }
    : { href: "/admin/portfolio", label: "Home page" };

  return (
    <Container className="pt-10 pb-20">
      <Link href={back.href} className="text-graphite hover:text-accent mb-6 inline-block text-sm">
        ← {back.label}
      </Link>

      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">{item.name || "Untitled piece"}</h1>
        <p className="text-graphite mt-1 text-sm">
          This piece&rsquo;s own page. Right-click to add images and text — anything you put here is
          part of the page, and never links anywhere.
        </p>
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
        snapEnabled={settings.snapEnabled}
        gutter={settings.gutterEnabled ? settings.gutter : 0}
        gridEnabled={settings.gridEnabled}
        gridColumns={settings.gridColumns}
        gridSnap={settings.gridSnap}
        scope={scope}
        fonts={mergeFonts(fonts)}
      />
    </Container>
  );
}
