import { SiteHeader } from "@/components/site-header";
import { fadeScript } from "@/lib/fade-script";
import { SiteFooter } from "@/components/site-footer";

/** Chrome for the public site. The admin deliberately does not get this. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
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
      <div id="main" className="flex-1">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
