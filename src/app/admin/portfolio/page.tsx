import { Container } from "@/components/container";
import { PortfolioCanvas } from "@/components/admin/portfolio-canvas";
import { PageSettingsPanel } from "@/components/admin/page-settings";
import { getAllPortfolioItems } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import { requireSession } from "@/lib/auth";
import { createPortfolioItem, updateHomeCopy } from "../portfolio-actions";

export const dynamic = "force-dynamic";

export default async function PortfolioAdminPage() {
  await requireSession();
  const [items, settings] = await Promise.all([getAllPortfolioItems(), getSiteSettings()]);

  const field =
    "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <Container className="pt-10 pb-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Home page</h1>
          <p className="text-graphite mt-1 text-sm">
            The heading, the introduction, and the wall of work beneath them.
          </p>
        </div>

        <form action={createPortfolioItem}>
          <button
            type="submit"
            className="bg-accent text-paper hover:bg-ink px-5 py-3 text-sm transition-colors"
          >
            Add a piece
          </button>
        </form>
      </div>

      <form action={updateHomeCopy} className="mb-12 flex max-w-2xl flex-col gap-4">
        <label className="text-graphite text-xs">
          Heading
          <input
            name="homeTitle"
            defaultValue={settings.homeTitle}
            className={`${field} font-display mt-1 !text-xl`}
          />
        </label>
        <label className="text-graphite text-xs">
          Introduction
          <textarea
            name="homeBlurb"
            defaultValue={settings.homeBlurb}
            rows={3}
            className={`${field} mt-1`}
          />
        </label>
        <button
          type="submit"
          className="border-line hover:border-ink self-start border px-4 py-2 text-sm transition-colors"
        >
          Save heading and introduction
        </button>
      </form>

      <PageSettingsPanel
        settings={{
          gutterEnabled: settings.gutterEnabled,
          gutter: settings.gutter,
          snapEnabled: settings.snapEnabled,
          showNamesOnHover: settings.showNamesOnHover,
        }}
      />

      <h2 className="text-graphite mb-3 text-xs tracking-[0.18em] uppercase">The wall</h2>
      <PortfolioCanvas
        items={items}
        snapEnabled={settings.snapEnabled}
        gutter={settings.gutterEnabled ? settings.gutter : 0}
      />

      <p className="text-graphite mt-4 max-w-2xl text-xs">
        This arrangement is what visitors see on a computer. On a phone the pieces stack in reading
        order — top to bottom, then left to right — because a layout composed at this width cannot
        be squeezed onto a small screen.
      </p>
    </Container>
  );
}
