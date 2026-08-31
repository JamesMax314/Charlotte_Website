import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { ImageManager } from "@/components/admin/image-manager";
import { getPortfolioItemById } from "@/lib/portfolio-queries";
import { requireSession } from "@/lib/auth";
import {
  deletePortfolioImage,
  deletePortfolioItem,
  reorderPortfolioImages,
  updatePortfolioImageAlt,
  updatePortfolioItem,
} from "../../portfolio-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditPortfolioItemPage({ params }: Props) {
  await requireSession();
  const { id } = await params;
  const item = await getPortfolioItemById(id);
  if (!item) notFound();

  const field =
    "border-line focus:border-ink w-full border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <Container className="max-w-3xl pt-10 pb-20">
      <Link
        href="/admin/portfolio"
        className="text-graphite hover:text-accent mb-6 inline-block text-sm"
      >
        ← The wall
      </Link>

      <form action={updatePortfolioItem.bind(null, item.id)} className="flex flex-col gap-4">
        <label className="text-graphite text-xs">
          Name
          <input
            name="name"
            defaultValue={item.name}
            required
            className={`${field} mt-1 !text-lg`}
          />
        </label>

        <label className="text-graphite text-xs">
          About this piece
          <textarea
            name="information"
            defaultValue={item.information}
            rows={6}
            placeholder="What it was for, who it was made with, anything worth knowing."
            className={`${field} mt-1`}
          />
        </label>

        <label className="text-graphite text-xs">
          Web address
          <input name="slug" defaultValue={item.slug} className={`${field} mt-1 font-mono`} />
        </label>

        <label className="text-graphite text-xs">
          Status
          <select name="status" defaultValue={item.status} className={`${field} mt-1`}>
            <option value="published">On the home page</option>
            <option value="draft">Draft — only you can see it</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="bg-accent text-paper hover:bg-ink px-5 py-3 text-sm transition-colors"
          >
            Save
          </button>
          {item.status === "published" && (
            <Link
              href={`/work/${item.slug}`}
              className="text-graphite hover:text-accent text-sm underline underline-offset-4"
            >
              View on the site
            </Link>
          )}
        </div>
      </form>

      <div className="border-line mt-12 border-t pt-8">
        <ImageManager
          parentId={item.id}
          uploadField="portfolioItemId"
          images={item.images}
          reorder={reorderPortfolioImages}
          updateAlt={updatePortfolioImageAlt}
          remove={deletePortfolioImage}
          heading="Images"
          hint="Drag to reorder. The first image is the cover shown on the home page; the rest appear on this piece's own page."
        />
      </div>

      <div className="border-line mt-12 border-t pt-8">
        <form action={deletePortfolioItem.bind(null, item.id)}>
          <button
            type="submit"
            className="text-graphite px-2 py-2 text-sm underline underline-offset-4 hover:text-red-700"
          >
            Delete this piece
          </button>
        </form>
      </div>
    </Container>
  );
}
