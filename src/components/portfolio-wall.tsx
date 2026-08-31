import Image from "next/image";
import Link from "next/link";
import { canvasHeightRatio, coverImage, inReadingOrder, type PortfolioItem } from "@/lib/portfolio";

/**
 * The home page wall.
 *
 * Positions are percentages of the canvas width (see the schema), so the whole
 * arrangement scales proportionally with the viewport. Below `md` the
 * arrangement is abandoned for a reading-order stack — a layout composed at
 * desktop proportions cannot survive being squeezed to a phone.
 */

function Tile({ item, priority }: { item: PortfolioItem; priority?: boolean }) {
  const cover = coverImage(item);
  if (!cover) return null;

  return (
    <Link href={`/work/${item.slug}`} className="group relative block overflow-hidden">
      <Image
        src={cover.src}
        alt={cover.alt}
        width={cover.width}
        height={cover.height}
        priority={priority}
        sizes="(min-width: 1152px) 576px, (min-width: 768px) 50vw, 100vw"
        className="h-auto w-full"
      />

      {/*
        The wall carries no captions by design. The name appears only on hover,
        and the overlay is also focus-visible so keyboard users are not left
        without it.
      */}
      <span
        className="bg-ink/70 text-paper absolute inset-0 flex items-center justify-center p-4 text-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        <span className="font-display text-lg tracking-tight text-balance">{item.name}</span>
      </span>
    </Link>
  );
}

export function PortfolioWall({ items }: { items: PortfolioItem[] }) {
  const shown = items.filter((item) => coverImage(item));
  if (shown.length === 0) return null;

  const ratio = canvasHeightRatio(shown);

  return (
    <>
      <div className="flex flex-col gap-10 md:hidden">
        {inReadingOrder(shown).map((item, i) => (
          <Tile key={item.id} item={item} priority={i === 0} />
        ))}
      </div>

      <div className="relative hidden md:block" style={{ aspectRatio: `100 / ${ratio}` }}>
        {shown.map((item, i) => (
          <div
            key={item.id}
            className="absolute"
            style={{
              left: `${item.x}%`,
              // y is a percentage of width, so convert it to a share of height.
              top: `${(item.y / ratio) * 100}%`,
              width: `${item.width}%`,
              zIndex: item.z,
            }}
          >
            <Tile item={item} priority={i === 0} />
          </div>
        ))}
      </div>
    </>
  );
}
