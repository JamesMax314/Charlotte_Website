import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { NavPages } from "@/components/admin/nav-pages";
import { PublishButton } from "@/components/admin/publish-button";
import { UndoProvider } from "@/components/admin/undo-provider";
import { hasValidSession } from "@/lib/auth";
import { getAllSitePages } from "@/lib/site-pages-queries";
import { logout } from "./actions";

// Admin must never be indexed, and never cached.
export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await hasValidSession();
  /*
    Gated on the session so the login page still renders when D1 is
    unreachable.

    The publish state is deliberately *not* read here any more. It hashes every
    content table to answer one boolean, and this layout re-renders on every
    admin mutation — so the artist was paying for a whole-site read on every
    keystroke in a text box, and enough of those at once is the
    `1102 Worker exceeded resource limit` she hit. `PublishButton` asks for it
    itself now, on its own request with its own CPU budget.
  */
  const pages = signedIn ? await getAllSitePages() : [];

  return (
    /*
      Wraps the top bar as well as the page, because the bar is a surface the
      artist edits on: the nav links reorder by drag and the + creates a page.
      It is also what scopes the history — see UndoProvider, which clears on
      every change of pathname.
    */
    <UndoProvider>
      <div className="min-h-dvh">
        {signedIn && (
          <div className="border-line bg-paper-sunk border-b">
            {/*
              Laid out like the public header, deliberately: the artist's pages
              sit in the middle of both bars, so the studio's top bar is a
              preview of the thing she is arranging rather than a settings
              screen about it.
            */}
            <Container className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 md:grid md:grid-cols-[1fr_auto_1fr]">
              <div className="mr-auto flex items-center gap-3 md:mr-0">
                <Mark className="text-ink h-6 w-6" />
                {/*
                  Baseline, not centre. The wordmark is `text-base` and the section
                  links are `text-sm`, and centring two different line-heights
                  puts their baselines apart — which reads as the links
                  floating above "Studio". The mark stays outside this group and
                  keeps centring on the bar, because an SVG has no baseline worth
                  sharing.
                */}
                <div className="flex items-baseline gap-3">
                  <Link href="/admin/portfolio" className="font-display text-base tracking-tight">
                    Studio
                  </Link>
                  {/*
                    No "Home page" here: it leads the middle nav now, where it
                    mirrors the site's own bar. Two links to the same wall a few
                    inches apart is the opposite of making it easy to find.
                  */}
                  <Link
                    href="/admin/settings"
                    className="text-graphite hover:text-accent text-sm transition-colors"
                  >
                    Settings
                  </Link>
                  <Link
                    href="/admin/shop"
                    className="text-graphite hover:text-accent text-sm transition-colors"
                  >
                    Store
                  </Link>
                </div>
              </div>

              {/*
                Always rendered, even with no pages yet — it holds the + that
                creates the first one, and it keeps the middle column occupied so
                the right-hand controls stay at the end of the bar.
              */}
              <div className="order-last w-full md:order-none md:w-auto md:justify-self-center">
                <NavPages pages={pages} />
              </div>

              <div className="flex items-center gap-4 md:justify-self-end">
                <PublishButton />
                {/*
                  A plain `<a>`, not `<Link>`. This is the only route from the
                  admin into the public site, whose layout renders an inline
                  `<script>` that has to run while the browser parses the HTML —
                  see `fadeScript`. A client-side transition mounts that layout
                  without a parse ever happening, so the script tag lands inert
                  in the DOM and React refuses to render it, throwing "Encountered
                  a script tag while rendering React component" instead. A full
                  navigation is what the script was always built to expect.
                */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full navigation is the point, see above */}
                <a href="/" className="text-graphite hover:text-accent text-sm transition-colors">
                  View site
                </a>
                {/*
                  `flex` so the form is not a line box. As a block it lays the
                  button out as inline content, which reserves room for a
                  descender underneath and drops "Sign out" 1.5px below the link
                  beside it.
                */}
                <form action={logout} className="flex">
                  <button type="submit" className="text-graphite hover:text-accent text-sm">
                    Sign out
                  </button>
                </form>
              </div>
            </Container>
          </div>
        )}
        {children}
      </div>
    </UndoProvider>
  );
}
