import Image from "next/image";
import Link from "next/link";
import { FadeIn } from "./fade-in";
import {
  canvasHeightRatio,
  coverImage,
  headingTextId,
  inReadingOrder,
  isInteractive,
  isLikelyAboveFold,
  lcpCandidateId,
  showsHoverName,
  textStyle,
  type PortfolioItem,
  type WallText,
} from "@/lib/portfolio";

/**
 * The home page wall.
 *
 * Rendered once. Position, size and reading order arrive as custom properties
 * and the stylesheet decides what to do with them: a stack on a phone, the
 * artist's arrangement above `md`. A layout composed at desktop proportions
 * cannot survive being squeezed to a phone, but rendering it twice cost double
 * the HTML, two <h1> elements and a duplicated priority image.
 *
 * Positions are percentages of the canvas width (see the schema), so the
 * arrangement scales proportionally with the viewport.
 */

/** Custom properties are not in React's CSSProperties type. */
type WallVars = React.CSSProperties & Record<`--${string}`, string | number>;

function Tile({
  item,
  priority,
  eager,
  showName,
}: {
  item: PortfolioItem;
  /** The likely LCP image: preloaded and fetched at high priority. */
  priority?: boolean;
  /** Above the fold, so not lazily loaded, but not worth preloading either. */
  eager?: boolean;
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
        // next/image rejects both at once — priority already implies eager.
        {...(priority ? {} : { loading: eager ? ("eager" as const) : ("lazy" as const) })}
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

/**
 * One positioned element on the wall.
 *
 * The fade, when on, is applied to this element rather than a wrapper: an
 * extra div between the wall and its children would break the positioning.
 */
function WallElement({
  fade,
  style,
  children,
}: {
  fade: boolean;
  style: WallVars;
  children: React.ReactNode;
}) {
  return fade ? (
    <FadeIn className="wall-item" style={style}>
      {children}
    </FadeIn>
  ) : (
    <div className="wall-item" style={style}>
      {children}
    </div>
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

  /*
    Lazily loading an image that is already on screen is always wrong: the
    browser will not fetch it until layout proves it is needed, which delays
    the Largest Contentful Paint. One piece is preloaded and the rest of the
    first screenful merely opts out of lazy loading, so they do not all compete
    for bandwidth.
  */
  const lcpId = lcpCandidateId(shown);

  /*
    Reading order for the stacked layout, top to bottom then left to right, so
    a heading written above a piece still reads above it on a phone. Emitted as
    a CSS `order` rather than a second render of the same content.
  */
  const order = new Map<string, number>(
    [
      ...texts.map((t) => ({ id: t.id, x: t.x, y: t.y })),
      ...inReadingOrder(shown).map((i) => ({ id: i.id, x: i.x, y: i.y })),
    ]
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
      .map((entry, index) => [entry.id, index]),
  );

  const place = (el: { id: string; x: number; y: number; width: number; z: number }): WallVars => ({
    "--x": el.x,
    "--top": (el.y / ratio) * 100,
    "--w": el.width,
    "--z": el.z,
    "--order": order.get(el.id) ?? 0,
  });

  return (
    <div className="wall" style={{ "--ratio": ratio } as WallVars}>
      {texts.map((text) => {
        const Tag = text.id === headingId ? "h1" : "p";
        return (
          <div key={text.id} className="wall-item" style={place(text)}>
            <Tag
              className="wall-text leading-snug whitespace-pre-wrap"
              style={
                {
                  ...textStyle(text, { includeFontSize: false }),
                  "--fs": text.fontSize,
                } as WallVars
              }
            >
              {text.content}
            </Tag>
          </div>
        );
      })}

      {shown.map((item) => (
        <WallElement key={item.id} fade={fadeIn} style={place(item)}>
          <Tile
            item={item}
            priority={item.id === lcpId}
            eager={isLikelyAboveFold(item)}
            showName={showNamesOnHover}
          />
        </WallElement>
      ))}
    </div>
  );
}
