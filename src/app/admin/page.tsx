import { Container } from "@/components/container";
import { ArrangeGrid } from "@/components/admin/arrange-grid";
import { getAllArtworks } from "@/lib/catalogue";
import { requireSession } from "@/lib/auth";
import { createArtwork } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireSession();
  const artworks = await getAllArtworks();

  return (
    <Container className="pt-10 pb-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Your work</h1>
          <p className="text-graphite mt-1 text-sm">
            {artworks.length} {artworks.length === 1 ? "piece" : "pieces"}. The order here is the
            order on the site.
          </p>
        </div>

        <form action={createArtwork}>
          <input type="hidden" name="title" value="Untitled" />
          <button
            type="submit"
            className="bg-accent text-paper hover:bg-ink px-5 py-3 text-sm transition-colors"
          >
            Add a piece
          </button>
        </form>
      </div>

      {artworks.length === 0 ? (
        <p className="border-line text-graphite border border-dashed px-6 py-16 text-center text-sm">
          Nothing here yet. Add your first piece to get started.
        </p>
      ) : (
        <ArrangeGrid artworks={artworks} />
      )}
    </Container>
  );
}
