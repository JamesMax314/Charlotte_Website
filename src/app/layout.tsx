import type { Metadata } from "next";
import { Caveat, Fraunces, IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_ACCENT, judgeAccent, normaliseHex } from "@/lib/colour";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME } from "@/lib/default-copy";
import { fontFaceCss } from "@/lib/fonts";
import { firstText, siteOpenGraph, siteTwitter, socialImage } from "@/lib/seo";
import { getSiteFonts } from "@/lib/site-settings";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/*
  Offered to the artist for wall text. Declaring a family costs a few @font-face
  rules; browsers fetch one only when something on the page actually uses it, so
  the unused ones do not slow the site down.
*/
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

/**
 * Title and icon come from the settings the artist controls.
 *
 * `icons.icon` points at /media rather than a file convention, because the
 * bytes already exist in R2 — and because keys are content-addressed, a
 * replaced mark lands on a new URL, which is what gets past the browser's
 * notoriously sticky favicon cache. The drawn SVG moved to public/ for the
 * fallback: while it sat in src/app it was picked up as file-based metadata,
 * which always wins over this.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const name = settings.siteName || DEFAULT_SITE_NAME;
  // A stored empty string spreads over the settings fallback, so the default
  // cannot be reached by the fallback alone — the chain has to be here.
  const description = firstText(settings.siteDescription, DEFAULT_SITE_DESCRIPTION);
  const { image, card } = socialImage({
    siteName: name,
    shareImageKey: settings.shareImageKey,
    shareImageWidth: settings.shareImageWidth,
    shareImageHeight: settings.shareImageHeight,
    faviconKey: settings.faviconKey,
  });

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${name} — illustration`, template: `%s · ${name}` },
    description,
    /*
      Relative on purpose, and it must stay relative.

      Next merges a page's metadata over the layout's by replacing whole keys,
      so an absolute canonical here would be inherited verbatim by every page
      that does not set its own — stamping the home page's address on /about and
      /privacy and telling Google they are duplicates of it. A "./" is resolved
      against the request's own pathname instead (resolveRelativeUrl in Next's
      metadata resolver), so each page self-canonicalises and "/" comes out as
      the bare origin.
    */
    alternates: { canonical: "./" },
    authors: [{ name, url: SITE_URL }],
    creator: name,
    publisher: name,
    openGraph: siteOpenGraph({ description, path: "/", siteName: name, image }),
    twitter: siteTwitter({ description, image, card }),
    icons: { icon: settings.faviconKey ? `/media/${settings.faviconKey}` : "/icon.svg" },
  };
}

/**
 * Document shell only. The public site and the admin have separate chrome —
 * see (site)/layout.tsx and admin/layout.tsx.
 *
 * `suppressHydrationWarning` on <html> is deliberate. The site layout's inline
 * script adds `js-fade` to this element while the document is still parsing, so
 * by the time React hydrates the class list no longer matches what the server
 * sent. That mismatch is the mechanism, not a bug: it is what hides the wall
 * before its first paint instead of after.
 *
 * The attribute covers this element only — it does not extend to descendants,
 * so a real mismatch anywhere in the tree is still reported.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, fonts] = await Promise.all([getSiteSettings(), getSiteFonts()]);

  /*
    The artist's highlight, and the foreground derived from it.

    Validated here as well as on write: the value is interpolated into a
    stylesheet, so it is checked at both ends rather than trusted because the
    other end checked it. Same defence in depth as the wall's text colours.
  */
  const accent = normaliseHex(settings.accentColour) ?? DEFAULT_ACCENT;

  /*
    The uploaded faces ride along in the same block. One declaration covers the
    public wall, the admin canvas and the toolbar's per-option previews, and a
    face is only fetched when something on the page actually uses it — the same
    reasoning as the Google families declared above.
  */
  const siteStyle =
    `:root{--accent:${accent};--accent-ink:${judgeAccent(accent).ink}}` + fontFaceCss(fonts);

  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} ${caveat.variable}`}
    >
      <body>
        {/*
          Server-rendered ahead of any content, so the colour is right on the
          first paint — the same reasoning as the site layout's inline fade
          script, and unlike anything applied from an effect.

          It lives in the root layout rather than the site layout because the
          admin uses these tokens too, and the artist has to see her colour
          applied while she is choosing it.
        */}
        <style dangerouslySetInnerHTML={{ __html: siteStyle }} />
        {children}
      </body>
    </html>
  );
}
