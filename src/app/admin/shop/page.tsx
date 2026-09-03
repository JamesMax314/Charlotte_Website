import { Container } from "@/components/container";
import { ArrangeGrid } from "@/components/admin/arrange-grid";
import { getAllArtworks } from "@/lib/catalogue";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminShop() {
  await requireSession();
  const artworks = await getAllArtworks();

  return (
    <Container className="pt-10 pb-16">
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-tight">Your work</h1>
        <p className="text-graphite mt-1 text-sm">
          {artworks.length} {artworks.length === 1 ? "piece" : "pieces"}. The order here is the
          order in the shop. Right-click a piece — or use its ⋯ button — for everything else.
        </p>
      </div>

      <ArrangeGrid artworks={artworks} />
    </Container>
  );
}
