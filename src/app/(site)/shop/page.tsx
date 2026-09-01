import type { Metadata } from "next";
import { Container } from "@/components/container";
import { ArtworkGrid } from "@/components/artwork-grid";
import { getPublishedArtworks } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// this renders per request. Revisit with "use cache" once there is traffic
// that justifies it — see docs/progress.md.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description: "Prints and digital downloads, sold through Etsy.",
  alternates: { canonical: `${SITE_URL}/shop` },
};

export default async function ShopPage() {
  const artworks = await getPublishedArtworks();

  return (
    <Container>
      <header className="border-line mb-10 border-b pb-6">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Shop</h1>
        <p className="text-graphite mt-2 max-w-prose text-sm">
          Every piece is sold through Etsy, which handles payment, postage and returns.
        </p>
      </header>

      {artworks.length === 0 ? (
        <p className="border-line text-graphite border border-dashed px-6 py-16 text-center text-sm">
          Nothing is for sale just yet. Do come back.
        </p>
      ) : (
        <ArtworkGrid artworks={artworks} />
      )}
    </Container>
  );
}
