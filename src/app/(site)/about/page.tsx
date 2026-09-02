import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/container";
import { JsonLd } from "@/components/json-ld";
import { DrawnRule } from "@/components/drawn-rule";
import { RichTextBlocks } from "@/components/rich-text";
import { mergeFonts } from "@/lib/fonts";
import { copyDoc, docToPlain } from "@/lib/rich-text";
import { getSiteFonts } from "@/lib/site-settings";
import { Mark } from "@/components/mark";
import { getSiteSettings } from "@/lib/catalogue";
import {
  DEFAULT_ABOUT_COPY,
  DEFAULT_ALTERNATE_NAMES,
  DEFAULT_CONTACT_COPY,
  DEFAULT_JOB_TITLE,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  DEFAULT_TOPICS,
} from "@/lib/default-copy";
import { absoluteUrl, firstText, metaDescription, siteEntityJsonLd } from "@/lib/seo";

// The root layout's header and footer read site settings from D1, so this page
// cannot be prerendered without baking in stale settings.
export const dynamic = "force-dynamic";

/**
 * Her own words, not a fixed sentence about prints.
 *
 * /about is the second page a search for the artist's name lands on, so the
 * description should be the copy she actually wrote — which is exactly the use
 * `docToPlain` exists for. The old string stays as the last resort.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const copy = docToPlain(copyDoc(settings.aboutRich, settings.aboutCopy, DEFAULT_ABOUT_COPY));

  return {
    title: "About",
    description:
      metaDescription(copy) ||
      "About the artist, how the prints are made, and how to get in touch.",
  };
}

export default async function AboutPage() {
  const settings = await getSiteSettings();

  /*
    The stored column is NOT NULL DEFAULT '', so an empty string spreads over
    the settings fallback and the reader alone cannot cover this. Falling back
    here means a stray "select all, delete" leaves the page readable rather
    than reduced to the single word "About".
  */
  const [fonts] = await Promise.all([getSiteFonts()]);
  const registry = mergeFonts(fonts);
  const body = copyDoc(settings.aboutRich, settings.aboutCopy, DEFAULT_ABOUT_COPY, registry);
  const contact = copyDoc(
    settings.contactRich,
    settings.contactCopy,
    DEFAULT_CONTACT_COPY,
    registry,
  );

  const photo =
    settings.aboutPhotoKey && settings.aboutPhotoWidth && settings.aboutPhotoHeight
      ? {
          key: settings.aboutPhotoKey,
          width: settings.aboutPhotoWidth,
          height: settings.aboutPhotoHeight,
          lqip: settings.aboutPhotoLqip,
          alt: settings.aboutPhotoAlt,
        }
      : null;

  return (
    <Container>
      {/*
        The same two nodes the home page emits, under the same `@id`. Repeating
        one entity across the two pages that are about her is valid and is what
        a crawler expects; it is repeating it on every artwork that is noise.
      */}
      <JsonLd
        nodes={siteEntityJsonLd({
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
        })}
      />

      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        {/*
          Below lg the grid collapses to one column and the photo stacks above
          the copy, which is the right reading order without any ordering to
          maintain. The width cap is what stops a portrait photograph filling a
          whole phone screen before the visitor reaches a word of prose.
        */}
        <div>
          {photo ? (
            <Image
              src={`/media/${photo.key}`}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              sizes="(min-width: 1024px) 33vw, 60vw"
              {...(photo.lqip ? { placeholder: "blur" as const, blurDataURL: photo.lqip } : {})}
              className="h-auto w-full max-w-xs lg:max-w-none"
            />
          ) : (
            <Mark className="text-ink h-24 w-24" />
          )}
        </div>

        <div className="max-w-prose">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">About</h1>

          <div className="mt-6 space-y-5 leading-relaxed text-pretty">
            <RichTextBlocks doc={body} fonts={registry} className="whitespace-pre-line" />
          </div>

          {/*
            Contact lives beneath the about copy rather than on a page of its
            own. The id is what keeps a link shared before the merge useful:
            /contact now redirects here, and to this heading rather than to the
            top of a page whose first screen is about something else. The
            scroll margin clears the top bar, whose height the artist sets.
          */}
          <section id="contact" aria-labelledby="contact-heading" className="mt-14 scroll-mt-32">
            <DrawnRule className="mb-10" />

            <h2 id="contact-heading" className="font-display text-2xl tracking-tight sm:text-3xl">
              Contact
            </h2>

            <div className="mt-6 space-y-5 leading-relaxed text-pretty">
              <RichTextBlocks doc={contact} fonts={registry} className="whitespace-pre-line" />
            </div>

            {/* No address, no button: better than a mailto: that goes nowhere. */}
            {settings.contactEmail && (
              <a
                href={`mailto:${settings.contactEmail}`}
                className="bg-accent text-accent-ink hover:bg-ink hover:text-paper mt-8 inline-block px-5 py-3.5 text-sm transition-colors"
              >
                {settings.contactEmail}
              </a>
            )}

            {settings.etsyShopUrl && (
              <p className="text-graphite mt-8 text-sm leading-relaxed">
                Questions about an order you have already placed are fastest through Etsy messages,
                since that is where the order details live.
              </p>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
}
