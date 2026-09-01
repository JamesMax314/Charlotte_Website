import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { getSiteSettings } from "@/lib/catalogue";
import { toParagraphs } from "@/lib/copy";
import { DEFAULT_ABOUT_COPY } from "@/lib/default-copy";

// The root layout's header and footer read site settings from D1, so this page
// cannot be prerendered without baking in stale settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "About the artist, and how the prints are made.",
};

export default async function AboutPage() {
  const settings = await getSiteSettings();

  /*
    The stored column is NOT NULL DEFAULT '', so an empty string spreads over
    the settings fallback and the reader alone cannot cover this. Falling back
    here means a stray "select all, delete" leaves the page readable rather
    than reduced to the single word "About".
  */
  const written = toParagraphs(settings.aboutCopy);
  const body = written.length > 0 ? written : toParagraphs(DEFAULT_ABOUT_COPY);

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
            {body.map((paragraph, i) => (
              // Pre-line, not pre-wrap: a blank line starts a paragraph, and a
              // single newline stays inside one.
              <p key={i} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
