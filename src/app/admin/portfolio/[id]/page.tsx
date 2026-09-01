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

  const [items, texts, settings, fonts] = await Promise.all([
    getAllPortfolioItems(id),
    getWallTexts(id),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  return (
    <Container className="pt-10 pb-20">
      <Link
        href="/admin/portfolio"
        className="text-graphite hover:text-accent mb-6 inline-block text-sm"
      >
        ← Home page
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
        parentId={id}
        fonts={mergeFonts(fonts)}
      />
    </Container>
  );
}
