import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** Chrome for the public site. The admin deliberately does not get this. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Runs while the document is still parsing, so the wall is hidden before
        its first paint rather than after — otherwise pieces flash in, vanish,
        then fade.

        The timeout is the safety net: if the class went on but the bundle never
        arrived to reveal anything, the page would stay blank. Finding no
        revealed piece after five seconds means hydration did not happen, so the
        class comes off and the content shows.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var d=document,h=d.documentElement;h.classList.add('js-fade');" +
            "setTimeout(function(){if(!d.querySelector('.fade-target.is-visible'))" +
            "h.classList.remove('js-fade')},5000)})()",
        }}
      />
      <a
        href="#main"
        className="bg-ink text-paper sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <SiteHeader />
      <div id="main" className="flex-1">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
