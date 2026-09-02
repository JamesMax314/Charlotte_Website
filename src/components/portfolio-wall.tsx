import Image from "next/image";
import Link from "next/link";
import { FadeIn } from "./fade-in";
import { RichTextInline } from "./rich-text";
import {
  canvasHeightRatio,
  coverImage,
  headingTextId,
  eagerIds,
  inReadingOrder,
  isInteractive,
  showsHoverName,
  textStyle,
  type PortfolioItem,
  type WallText,
} from "@/lib/portfolio";
import { BUILT_IN_FONTS, type FontOption } from "@/lib/fonts";

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
  showName,
}: {
  item: PortfolioItem;
  /** The likely LCP image: preloaded and fetched at high priority. */
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
        // next/image rejects both at once — priority already implies eager.
        {...(priority ? {} : { loading: "lazy" as const })}
        /*
          The mobile figure is deliberately smaller than the slot the image
          actually fills. At 90vw a 3x phone asks for ~1050px, and the ladder in
          image-loader.ts rounds that up to 1600 — eight of which decode to
          roughly 60MB of bitmap, past what a phone will hold. It evicts them
          and refetches, which is the artwork flickering as you scroll. At 60vw
          both 2x and 3x land on the 800 rung: a quarter of the memory, and
          still over twice the density of the slot.
        */
        sizes="(min-width: 768px) 50vw, 60vw"
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
  fonts = BUILT_IN_FONTS,
  heading,
}: {
  items: PortfolioItem[];
  texts: WallText[];
  showNamesOnHover: boolean;
  /**
   * The heading to fall back on when the artist has written no text.
   *
   * The largest text box becomes the page's `<h1>`, which is right while there
   * is one — but a wall of pictures and no words leaves the page with no
   * heading at all, and the home page is the one that has to be found by the
   * artist's name. Rendered out of sight, so her arrangement is untouched.
   */
  heading?: string;
  /** Site only. The editor never fades, or the artist could not see her work. */
  fadeIn?: boolean;
  /**
   * Built-ins plus whatever the artist has uploaded.
   *
   * Injected rather than imported, like the toolbar's list. Not passing it is
   * the failure with no symptom: an uploaded font resolves perfectly in the
   * admin and renders as Inter for every visitor, and nothing reports it.
   */
  fonts?: FontOption[];
}) {
  const shown = items.filter((item) => coverImage(item));

  // An empty wall still owes the page a heading. A piece's own page is
  // routinely empty — the artist adds child elements later, or never — and
  // returning nothing at all left /work/<slug> with no <h1> even though the
  // piece has a name.
  if (shown.length === 0 && texts.length === 0) {
    return heading ? <h1 className="sr-only">{heading}</h1> : null;
  }

  const ratio = canvasHeightRatio(shown, texts);
  const headingId = headingTextId(texts);

  /*
    At most two pieces are preloaded; everything else is lazy.

    The rest of the first screenful used to opt out of lazy loading too, chosen
    by `y` — a coordinate on the desktop arrangement. Below `md` that layout
    does not exist: the same pieces are a stack in reading order, so the ones
    marked eager were mostly far down a phone's page and fetched at full size
    anyway. Eight 1600px JPEGs decoded at once is more memory than a phone will
    hold, so it evicted and refetched them in a loop.

    Lazy costs nothing on a desktop, because `loading="lazy"` does not defer an
    image that is already in the viewport — it only defers the ones a visitor
    cannot see yet, which is exactly the behaviour the tall layout needs.

    Two ids rather than one because the layouts disagree about which image is
    the LCP, and this markup serves both. See `eagerIds`.
  */
  const eager = eagerIds(shown);

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
      {headingId === null && heading && <h1 className="sr-only">{heading}</h1>}

      {texts.map((text) => {
        const Tag = text.id === headingId ? "h1" : "p";
        return (
          <div key={text.id} className="wall-item" style={place(text)}>
            <Tag
              className="wall-text leading-snug whitespace-pre-wrap"
              style={
                {
                  ...textStyle(text, { includeFontSize: false, fonts }),
                  "--fs": text.fontSize,
                } as WallVars
              }
            >
              <RichTextInline doc={text.rich} fonts={fonts} />
            </Tag>
          </div>
        );
      })}

      {shown.map((item) => (
        <WallElement key={item.id} fade={fadeIn} style={place(item)}>
          <Tile item={item} priority={eager.has(item.id)} showName={showNamesOnHover} />
        </WallElement>
      ))}
    </div>
  );
}
