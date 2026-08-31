import type { Metadata } from "next";
import { Container } from "@/components/container";
import { ArtworkGrid } from "@/components/artwork-grid";
import { getPublishedArtworks } from "@/lib/artworks";

export const metadata: Metadata = {
  title: "Work",
  description: "Every available drawing and print.",
};

export default async function WorkPage() {
  const artworks = await getPublishedArtworks();

  return (
    <Container className="pt-16 pb-4">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Work</h1>
      <p className="text-graphite mt-3 mb-14 max-w-md text-pretty">
        {artworks.length} pieces. Prints are made to order and posted from the studio; everything is
        sold through Etsy.
      </p>
      <ArtworkGrid artworks={artworks} />
    </Container>
  );
}
