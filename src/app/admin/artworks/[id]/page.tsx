import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { ImageManager } from "@/components/admin/image-manager";
import { ListingsEditor } from "@/components/admin/listings-editor";
import { getArtworkById } from "@/lib/catalogue";
import { requireSession } from "@/lib/auth";
import {
  archiveArtwork,
  deleteArtworkPermanently,
  deleteImage,
  reorderImages,
  updateArtwork,
  updateImageAlt,
} from "../../actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditArtworkPage({ params }: Props) {
  await requireSession();
  const { id } = await params;
  const artwork = await getArtworkById(id);
  if (!artwork) notFound();

  const field =
    "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <Container className="max-w-3xl pt-10 pb-20">
      <Link href="/admin" className="text-graphite hover:text-accent mb-6 inline-block text-sm">
        ← All work
      </Link>

      <form action={updateArtwork.bind(null, artwork.id)} className="flex flex-col gap-4">
        <label className="text-graphite text-xs">
          Title
          <input
            name="title"
            defaultValue={artwork.title}
            required
            className={`${field} mt-1 !text-lg`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-graphite text-xs">
            Year
            <input
              name="year"
              type="number"
              defaultValue={artwork.year}
              className={`${field} mt-1`}
            />
          </label>
          <label className="text-graphite col-span-2 text-xs">
            Medium
            <input
              name="medium"
              defaultValue={artwork.medium}
              placeholder="Ink on paper"
              className={`${field} mt-1`}
            />
          </label>
        </div>

        <label className="text-graphite text-xs">
          Size of the original
          <input
            name="dimensionsNote"
            defaultValue={artwork.dimensionsNote ?? ""}
            placeholder="Original 42 × 52 cm"
            className={`${field} mt-1`}
          />
        </label>

        <label className="text-graphite text-xs">
          A few words about it
          <textarea
            name="description"
            defaultValue={artwork.description}
            rows={4}
            className={`${field} mt-1`}
          />
        </label>

        <label className="text-graphite text-xs">
          Web address
          <input name="slug" defaultValue={artwork.slug} className={`${field} mt-1 font-mono`} />
        </label>

        <div className="border-line flex flex-wrap items-center gap-6 border-t pt-4">
          <label className="text-xs">
            Status
            <select name="status" defaultValue={artwork.status} className={`${field} mt-1`}>
              <option value="draft">Draft — only you can see it</option>
              <option value="published">Live on the site</option>
              <option value="archived">Archived — off the gallery, link still works</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={artwork.isFeatured}
              className="size-4"
            />
            Show on the front page
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="bg-accent text-paper hover:bg-ink px-5 py-3 text-sm transition-colors"
          >
            Save
          </button>
          {artwork.status === "published" && (
            <Link
              href={`/work/${artwork.slug}`}
              className="text-graphite hover:text-accent text-sm underline underline-offset-4"
            >
              View on the site
            </Link>
          )}
        </div>
      </form>

      <div className="border-line mt-12 border-t pt-8">
        <ImageManager
          parentId={artwork.id}
          uploadField="artworkId"
          reorder={reorderImages}
          updateAlt={updateImageAlt}
          remove={deleteImage}
          images={artwork.images.map((image) => ({
            id: image.id,
            src: image.src,
            alt: image.alt,
            width: image.width,
            height: image.height,
          }))}
        />
      </div>

      <div className="border-line mt-12 border-t pt-8">
        <ListingsEditor artworkId={artwork.id} listings={artwork.listings} />
      </div>

      <div className="border-line mt-12 flex flex-wrap gap-4 border-t pt-8">
        {artwork.status !== "archived" && (
          <form action={archiveArtwork.bind(null, artwork.id)}>
            <button
              type="submit"
              className="border-line hover:border-ink border px-4 py-2 text-sm transition-colors"
            >
              Archive
            </button>
          </form>
        )}
        <form action={deleteArtworkPermanently.bind(null, artwork.id)}>
          <button
            type="submit"
            className="text-graphite px-2 py-2 text-sm underline underline-offset-4 hover:text-red-700"
          >
            Delete permanently
          </button>
        </form>
      </div>
    </Container>
  );
}
