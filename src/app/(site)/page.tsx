import type { Metadata } from "next";
import { Container } from "@/components/container";
import { JsonLd } from "@/components/json-ld";
import { PortfolioWall } from "@/components/portfolio-wall";
import { getPublishedWall, getWallTexts } from "@/lib/portfolio-queries";
import { getSiteSettings } from "@/lib/catalogue";
import {
  DEFAULT_ALTERNATE_NAMES,
  DEFAULT_JOB_TITLE,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  DEFAULT_TOPICS,
} from "@/lib/default-copy";
import { mergeFonts } from "@/lib/fonts";
import { inReadingOrder } from "@/lib/portfolio";
import {
  absoluteUrl,
  firstText,
  metaDescription,
  siteEntityJsonLd,
  siteOpenGraph,
  siteTwitter,
  socialImage,
} from "@/lib/seo";
import { getSiteFonts } from "@/lib/site-settings";

// D1 is unreachable during `next build` (no binding outside the Worker), so
// this renders per request. See docs/progress.md.
export const dynamic = "force-dynamic";

/**
 * The home page had no metadata at all: no description, no canonical, no card —
 * on the one page that has to rank for the artist's name.
 *
 * The description prefers what she wrote in settings, then the words actually
 * on the wall, then the built-in default. The middle rung matters more than it
 * looks: while the settings box is empty, the words a visitor reads and the
 * words Google shows are the same words, and they cannot drift.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [texts, settings] = await Promise.all([getWallTexts(), getSiteSettings()]);

  const siteName = settings.siteName || DEFAULT_SITE_NAME;
  const wallCopy = inReadingOrder(texts)
    .map((text) => text.content.trim())
    .filter(Boolean)
    .join(" ");

  const description = metaDescription(
    firstText(settings.siteDescription, wallCopy, DEFAULT_SITE_DESCRIPTION),
  );
  const { image, card } = socialImage({
    siteName,
    shareImageKey: settings.shareImageKey,
    shareImageWidth: settings.shareImageWidth,
    shareImageHeight: settings.shareImageHeight,
    faviconKey: settings.faviconKey,
  });

  return {
    description,
    openGraph: siteOpenGraph({ description, path: "/", siteName, image }),
    twitter: siteTwitter({ description, image, card }),
  };
}

export default async function HomePage() {
  const [items, texts, settings, fonts] = await Promise.all([
    getPublishedWall(),
    getWallTexts(),
    getSiteSettings(),
    getSiteFonts(),
  ]);

  /*
    Who the site is about, said once, here and on /about.

    A search for the artist's name is the measure this site is held to, and
    `sameAs` is what connects the domain to the accounts she already has. It is
    not repeated on every page: forty copies of the same node give a crawler
    forty things to reconcile and add bytes to every response for no signal —
    the artwork pages point at this one by `@id` instead.
  */
  const entity = siteEntityJsonLd({
    siteName: settings.siteName || DEFAULT_SITE_NAME,
    description: firstText(settings.siteDescription, DEFAULT_SITE_DESCRIPTION),
    imageUrl: settings.aboutPhotoKey
      ? absoluteUrl(`/media/${settings.aboutPhotoKey}`)
      : settings.faviconKey
        ? absoluteUrl(`/media/${settings.faviconKey}`)
        : null,
    alternateNames: DEFAULT_ALTERNATE_NAMES,
    jobTitle: DEFAULT_JOB_TITLE,
    topics: DEFAULT_TOPICS,
    instagramUrl: settings.instagramUrl,
    etsyShopUrl: settings.etsyShopUrl,
  });

  return (
    <Container>
      <JsonLd nodes={entity} />

      <PortfolioWall
        items={items}
        texts={texts}
        showNamesOnHover={settings.showNamesOnHover}
        fadeIn={settings.contentFadeIn}
        fonts={mergeFonts(fonts)}
        heading={settings.siteName || DEFAULT_SITE_NAME}
      />
    </Container>
  );
}
