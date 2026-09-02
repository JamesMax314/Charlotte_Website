/**
 * Everything the site says about itself to a search engine or a link preview.
 *
 * Pure, and deliberately so: it takes plain data and returns plain data, never
 * queries, and never imports `server-only`. That is what lets the rules below
 * be unit-tested without a binding — the same discipline `portfolio.ts` and
 * `settings-input.ts` follow, and the reason this repo's tests all live in
 * `src/lib`.
 */

import type { Metadata } from "next";
import mediaLoader from "@/image-loader";
import { SITE_URL } from "./site";

/** Roughly where Google truncates a description in a result. */
export const DESCRIPTION_LENGTH = 155;

/**
 * The width asked of the ladder for a card image.
 *
 * Rounds up to the 1600 rung, which is a good size for a crawler and a
 * quarter of the bytes of the 2400 original. `/media` falls back to the base
 * object if the derivative is missing, so this cannot 404.
 */
const CARD_WIDTH = 1200;

/** Shipped in `public/`, so a site with nothing uploaded still shares as something. */
export const FALLBACK_CARD = { path: "/og-default.png", width: 1200, height: 630 };

/**
 * An absolute URL, spelled the way Next spells it.
 *
 * Next resolves a relative `metadata` URL to the bare origin when the path is
 * `/` — no trailing slash — and `sitemap.ts` already emits `SITE_URL` bare. A
 * second spelling of the home page's own address would have the canonical, the
 * sitemap and the JSON-LD disagreeing about the most important URL on the site.
 */
export const absoluteUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  const rooted = path.startsWith("/") ? path : `/${path}`;
  return rooted === "/" ? SITE_URL : `${SITE_URL}${rooted}`;
};

/** The first candidate with something in it. */
export const firstText = (...candidates: (string | null | undefined)[]): string => {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return "";
};

/**
 * A description, cut to a whole word.
 *
 * The pages that had one at all used `.slice(0, 200)`, which cuts mid-word and
 * runs past what a result actually shows. Copy arrives with newlines in it —
 * the About page is paragraphs — so whitespace collapses first.
 */
export const metaDescription = (source: string, max: number = DESCRIPTION_LENGTH): string => {
  const flat = source.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;

  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace === -1 ? cut : cut.slice(0, lastSpace)).replace(/[,;:.\s]+$/, "")}…`;
};

export type SocialCard = "summary" | "summary_large_image";

export interface SocialImage {
  url: string;
  alt: string;
  /** Absent when the bytes were stored without their dimensions — see the mark. */
  width?: number;
  height?: number;
}

export interface SocialImageInput {
  /** The page's own picture: an artwork, already through the width ladder. */
  page?: { src: string; alt: string; width: number; height: number } | null;
  shareImageKey?: string | null;
  shareImageWidth?: number | null;
  shareImageHeight?: number | null;
  faviconKey?: string | null;
  siteName: string;
}

/**
 * The picture a shared link shows, and the card shape that suits it.
 *
 * The artist asked for her favicon to be the thumbnail. It is in the chain, but
 * it is third, because a mark is square and a large card is 1.91:1 — so a
 * platform either letterboxes it or crops it to nothing. When the mark is what
 * we have, the card is declared `summary` instead, which is the shape that
 * expects a logo.
 *
 * The last resort is a raster in `public/`, not `icon.svg`: no major platform
 * renders an SVG link preview, so the drawn mark would silently produce a card
 * with no picture at all.
 */
export const socialImage = (input: SocialImageInput): { image: SocialImage; card: SocialCard } => {
  const { page, shareImageKey, shareImageWidth, shareImageHeight, faviconKey, siteName } = input;

  if (page) {
    return {
      image: {
        url: absoluteUrl(mediaLoader({ src: page.src, width: CARD_WIDTH })),
        alt: page.alt || siteName,
        width: page.width,
        height: page.height,
      },
      card: "summary_large_image",
    };
  }

  if (shareImageKey) {
    return {
      image: {
        url: absoluteUrl(`/media/${shareImageKey}`),
        alt: siteName,
        ...(shareImageWidth && shareImageHeight
          ? { width: shareImageWidth, height: shareImageHeight }
          : {}),
      },
      card: "summary_large_image",
    };
  }

  // Stored exactly as uploaded, so there is no ladder rung to ask for and no
  // width recorded to declare.
  if (faviconKey) {
    return {
      image: { url: absoluteUrl(`/media/${faviconKey}`), alt: siteName },
      card: "summary",
    };
  }

  return {
    image: {
      url: absoluteUrl(FALLBACK_CARD.path),
      alt: siteName,
      width: FALLBACK_CARD.width,
      height: FALLBACK_CARD.height,
    },
    card: "summary_large_image",
  };
};

/**
 * A complete Open Graph block. Every route that sets one must build it here.
 *
 * Next merges page metadata over the layout's by *replacing* whole keys, not by
 * deepening them — `mergeMetadata` clones the parent and assigns
 * `resolved.openGraph = resolveOpenGraph(page.openGraph)`. So a page that sets
 * only a title drops the site name, the locale, the type and the image the root
 * layout supplied, and the card degrades on exactly the pages worth sharing.
 * Passing through here is what keeps the whole object intact.
 */
export const siteOpenGraph = (input: {
  title?: string;
  description?: string;
  path: string;
  siteName: string;
  image: SocialImage;
  type?: "website" | "article";
}): NonNullable<Metadata["openGraph"]> => ({
  type: input.type ?? "website",
  siteName: input.siteName,
  locale: "en_GB",
  url: absoluteUrl(input.path),
  ...(input.title ? { title: input.title } : {}),
  ...(input.description ? { description: input.description } : {}),
  images: [input.image],
});

/** As above: `twitter` is replaced wholesale too. */
export const siteTwitter = (input: {
  title?: string;
  description?: string;
  image: SocialImage;
  card: SocialCard;
}): NonNullable<Metadata["twitter"]> => ({
  card: input.card,
  ...(input.title ? { title: input.title } : {}),
  ...(input.description ? { description: input.description } : {}),
  images: [input.image],
});

/**
 * Profile links fit to publish as `sameAs`.
 *
 * `sameAs` is an identity claim: it tells Google this person *is* the account
 * at that address. The settings fallback ships `https://www.instagram.com/` and
 * `https://www.etsy.com/` as placeholders, and until the artist replaces them
 * that claim would be false — she is not Instagram. A bare origin names a
 * platform rather than an account, so it is dropped.
 */
export const profileLinks = (...urls: (string | null | undefined)[]): string[] => {
  const links: string[] = [];

  for (const candidate of urls) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;

    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      continue;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    if (url.pathname === "" || url.pathname === "/") continue;
    links.push(url.toString());
  }

  return links;
};

/**
 * Stable anchors for the two nodes that describe the site itself.
 *
 * The artist is one entity, described once on the pages that are about her, and
 * referred to by `@id` from every artwork. Repeating the whole `Person` on
 * forty pages gives a crawler forty nodes to reconcile and adds bytes to every
 * response for no signal.
 */
export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const personJsonLd = (input: {
  name: string;
  alternateNames?: readonly string[];
  jobTitle?: string;
  description?: string;
  imageUrl?: string | null;
  knowsAbout?: readonly string[];
  sameAs?: readonly string[];
}): Record<string, unknown> => ({
  "@type": "Person",
  "@id": PERSON_ID,
  name: input.name,
  url: absoluteUrl("/"),
  ...(input.alternateNames?.length ? { alternateName: [...input.alternateNames] } : {}),
  ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
  ...(input.description ? { description: input.description } : {}),
  ...(input.imageUrl ? { image: input.imageUrl } : {}),
  ...(input.knowsAbout?.length ? { knowsAbout: [...input.knowsAbout] } : {}),
  ...(input.sameAs?.length ? { sameAs: [...input.sameAs] } : {}),
});

export const webSiteJsonLd = (input: { name: string }): Record<string, unknown> => ({
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: absoluteUrl("/"),
  name: input.name,
  inLanguage: "en-GB",
  publisher: { "@id": PERSON_ID },
});

/**
 * A single artwork.
 *
 * `VisualArtwork` only. No `Product`, no `Offer`, no price: Etsy is the seller
 * and owns that markup, and claiming an offer we cannot honour is what earns a
 * structured-data penalty (brief N-03). A test asserts their absence.
 */
export const visualArtworkJsonLd = (input: {
  name: string;
  path: string;
  creatorName: string;
  imageUrl?: string | null;
  artform?: string | null;
  dateCreated?: string | null;
}): Record<string, unknown> => ({
  "@type": "VisualArtwork",
  name: input.name,
  url: absoluteUrl(input.path),
  // Named as well as anchored. An `@id` alone only resolves inside the
  // document it appears in, so an artwork page would carry a creator that is
  // an empty node; repeating the name against the same id lets a crawler merge
  // it with the full Person described on the pages that are about her.
  creator: { "@type": "Person", "@id": PERSON_ID, name: input.creatorName },
  ...(input.artform ? { artform: input.artform } : {}),
  ...(input.dateCreated ? { dateCreated: input.dateCreated } : {}),
  ...(input.imageUrl ? { image: input.imageUrl } : {}),
});

export const breadcrumbJsonLd = (
  trail: readonly { name: string; path: string }[],
): Record<string, unknown> => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((step, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: step.name,
    item: absoluteUrl(step.path),
  })),
});

/**
 * One `@graph` document, ready for a `<script type="application/ld+json">`.
 *
 * The `<` escape is not decoration. The body of a script element is not parsed
 * for entities, but it *is* scanned for `</script`, and `JSON.stringify` does
 * nothing to `<` — so an artwork the artist titled `</script><img onerror=…>`
 * closed the tag and the rest was parsed as markup. `<` is valid JSON,
 * parses back to the same string, and cannot end the element.
 */
export const jsonLdScriptContent = (nodes: Record<string, unknown>[]): string =>
  JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
