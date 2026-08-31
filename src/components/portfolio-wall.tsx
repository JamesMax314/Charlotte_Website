import Image from "next/image";
import Link from "next/link";
import { FadeIn } from "./fade-in";
import {
  canvasHeightRatio,
  coverImage,
  headingTextId,
  inReadingOrder,
  isInteractive,
  showsHoverName,
  textStyle,
  type PortfolioItem,
  type WallText,
} from "@/lib/portfolio";

/**
 * The home page wall.
 *
 * Positions are percentages of the canvas width (see the schema), so the whole
 * arrangement scales proportionally with the viewport. Below `md` the
 * arrangement is abandoned for a reading-order stack — a layout composed at
 * desktop proportions cannot survive being squeezed to a phone.
 */

function Tile({
  item,
  priority,
  showName,
}: {
  item: PortfolioItem;
  priority?: boolean;
  showName: boolean;
}) {
  const cover = coverImage(item);
  if (!cover) return null;

  const interactive = isInteractive(item);
  const named = showsHoverName(item, showName);

  const picture = (
    <>
      <Image
        src={cover.src}
        alt={cover.alt}
        width={cover.width}
        height={cover.height}
        priority={priority}
        sizes="(min-width: 768px) 50vw, 90vw"
        className="h-auto w-full"
      />

      {/*
        The wall carries no captions by design. The name appears only on hover,
        and the overlay is also focus-visible so keyboard users are not left
        without it.
      */}
      {named && (
        <span
          className="bg-ink/70 text-paper absolute inset-0 flex items-center justify-center p-4 text-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        >
          <span className="font-display text-lg tracking-tight text-balance">{item.name}</span>
        </span>
      )}
    </>
  );

  /*
    A piece that is not clickable renders as a plain image: no link, no hover
    state, no pointer cursor. That is what lets decorative marks and icons sit
    on the wall without pretending to be interactive, and it is why elements on
    a piece's own page are inert.
  */
  return interactive ? (
    <Link href={`/work/${item.slug}`} className="group relative block overflow-hidden">
      {picture}
    </Link>
  ) : (
    <div className="relative block overflow-hidden">{picture}</div>
  );
}

/** Wraps a piece only when the artist has asked for the fade. */
function MaybeFade({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? <FadeIn>{children}</FadeIn> : <>{children}</>;
}

function TextBlock({
  text,
  clamped,
  heading,
}: {
  text: WallText;
  clamped?: boolean;
  heading?: boolean;
}) {
  const Tag = heading ? "h1" : "p";
  return (
    <Tag className="leading-snug whitespace-pre-wrap" style={textStyle(text, { clamped })}>
      {text.content}
    </Tag>
  );
}

export function PortfolioWall({
  items,
  texts,
  showNamesOnHover,
  fadeIn = false,
}: {
  items: PortfolioItem[];
  texts: WallText[];
  showNamesOnHover: boolean;
  /** Site only. The editor never fades, or the artist could not see her work. */
  fadeIn?: boolean;
}) {
  const shown = items.filter((item) => coverImage(item));
  if (shown.length === 0 && texts.length === 0) return null;

  const ratio = canvasHeightRatio(shown, texts);
  const headingId = headingTextId(texts);

  // The mobile stack interleaves text and pieces in reading order, so a
  // heading written above a piece still reads above it on a phone.
  const stacked = [
    ...texts.map((t) => ({ kind: "text" as const, y: t.y, x: t.x, text: t })),
    ...inReadingOrder(shown).map((item) => ({
      kind: "item" as const,
      y: item.y,
      x: item.x,
      item,
    })),
  ].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  return (
    <>
      <div className="flex flex-col gap-10 md:hidden" style={{ containerType: "inline-size" }}>
        {stacked.map((entry, i) =>
          entry.kind === "text" ? (
            <TextBlock
              key={entry.text.id}
              text={entry.text}
              clamped
              heading={entry.text.id === headingId}
            />
          ) : (
            <MaybeFade key={entry.item.id} on={fadeIn}>
              <Tile item={entry.item} priority={i === 0} showName={showNamesOnHover} />
            </MaybeFade>
          ),
        )}
      </div>

      {/*
        Clipped, matching the editor canvas. Without this a piece bled past the
        edge would give the whole page a horizontal scrollbar, and the artist
        would see something different from what she arranged.
      */}
      <div
        className="relative hidden overflow-hidden md:block"
        // container-type lets text sizes resolve in cqw, so type scales with
        // the wall rather than jumping between breakpoints.
        style={{ aspectRatio: `100 / ${ratio}`, containerType: "inline-size" }}
      >
        {texts.map((text) => (
          <div
            key={text.id}
            className="absolute"
            style={{
              left: `${text.x}%`,
              top: `${(text.y / ratio) * 100}%`,
              width: `${text.width}%`,
              zIndex: text.z,
            }}
          >
            <TextBlock text={text} heading={text.id === headingId} />
          </div>
        ))}

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
            <MaybeFade on={fadeIn}>
              <Tile item={item} priority={i === 0} showName={showNamesOnHover} />
            </MaybeFade>
          </div>
        ))}
      </div>
    </>
  );
}
