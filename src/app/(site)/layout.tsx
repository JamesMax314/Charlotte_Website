import { SiteHeader } from "@/components/site-header";
import { fadeScript } from "@/lib/fade-script";
import { SiteFooter } from "@/components/site-footer";
import { getSiteSettings } from "@/lib/catalogue";
import { fontMimeType, mergeFonts, resolveSiteFaces } from "@/lib/fonts";
import { headerStyleFromSettings, headerTokenCss } from "@/lib/header-style";
import { getSiteFonts } from "@/lib/site-settings";

/** Chrome for the public site. The admin deliberately does not get this. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Both are cache()d and the root layout already reads them this pass, so
  // this costs no extra query.
  const [settings, uploaded] = await Promise.all([getSiteSettings(), getSiteFonts()]);
  const registry = mergeFonts(uploaded);
  const faces = resolveSiteFaces(settings, registry);
  // The top bar's proportions ride along with the faces, for the same reason:
  // set here rather than in the root layout, so the studio keeps its own
  // chrome whatever the artist chooses for her site.
  const header = headerStyleFromSettings(settings);

  /*
    An uploaded face gets none of what next/font gives the Google families: no
    @font-face in the head stylesheet, no preload, and no metric-matched local
    fallback. Its rules live in an inline <style> in the body, where the
    preload scanner never sees them — as a wall-text face that was a few words,
    but as the *body* face it is every page painting in the system sans and
    then reflowing when the bytes land.
  */
  const chosenUploads = [settings.headingFontId, settings.bodyFontId]
    .map((id) => uploaded.find((font) => font.id === id))
    .filter((font) => font !== undefined);

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        The artist's typefaces, and the reason they are set here rather than in
        the root layout: this layout does not render on admin routes, so the
        studio falls through to the defaults in globals.css and stays legible
        in Inter and Fraunces whatever she picks for her site.

        `:root` rather than a class on this element, because `body` is the one
        that has to compute the body face — a token set on a descendant would
        leave html and body on Inter while their children used something else,
        and "what face is this site in" would have two answers.

        No `precedence` prop, ever. React would hoist this into the head,
        dedupe it, and then *not* remove it on unmount — so going back to the
        studio would leave it painted in her faces. Without it the element's
        lifetime is this layout's lifetime and the tokens revert cleanly.

        The @font-face rules stay in the root layout: the wall editor's toolbar
        previews need them too, and the root layout already wraps this one.
      */}
      {/*
        Rendered as elements rather than through `ReactDOM.preload`. That helper
        is called while this nested layout renders, by which point the shell has
        already flushed, so React can only record it as a hint in the flight
        stream — the browser then learns about the font from the bundle instead
        of from the parser, which is the whole thing the preload was for. React
        hoists a <link> into the head wherever it is rendered, so this lands in
        the initial HTML.

        crossOrigin is required even though /media is same-origin: without it
        the preload is made in a different mode from the CSS-triggered fetch and
        the font is downloaded twice.
      */}
      {chosenUploads.map((font) => (
        <link
          key={font.id}
          rel="preload"
          as="font"
          type={fontMimeType(font.format)}
          href={`/media/${font.storageKey}`}
          crossOrigin="anonymous"
        />
      ))}
      <style
        data-site-faces=""
        dangerouslySetInnerHTML={{
          __html: `:root{--site-body:${faces.body};--site-display:${faces.display};${headerTokenCss(header)}}`,
        }}
      />
      {/*
        The reveal runs here, during parsing, and nowhere else. It is not in a
        component because nothing can fade in while `js-fade` hides it, so a
        reveal that waits for the bundle is a wall that waits for the bundle —
        which on a phone meant a blank gallery, and then, once the opening pass
        moved here, a gallery that never filled in below the fold. See
        `src/lib/fade-script.ts`.
      */}
      <script dangerouslySetInnerHTML={{ __html: fadeScript }} />
      <a
        href="#main"
        className="bg-ink text-paper sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <SiteHeader />
      {/*
        The space between the chrome and the page is owned here, not by each
        page. Every page used to set its own top and bottom padding and the
        footer added a further 96px beneath, so the gap above the content and
        the gap below it were never the same twice — which is exactly what the
        artist now has one control for.
      */}
      <div id="main" className="flex-1 py-[var(--content-space,64px)]">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
