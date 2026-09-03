import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { NavPages } from "@/components/admin/nav-pages";
import { PublishButton } from "@/components/admin/publish-button";
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
                Baseline, not centre. The wordmark is `text-sm` and the section
                links are `text-xs`, and centring two different line-heights
                puts their baselines 2px apart — which reads as the links
                floating above "Studio". The mark stays outside this group and
                keeps centring on the bar, because an SVG has no baseline worth
                sharing.
              */}
              <div className="flex items-baseline gap-3">
                <Link href="/admin/portfolio" className="font-display text-sm tracking-tight">
                  Studio
                </Link>
                {/*
                  No "Home page" here: it leads the middle nav now, where it
                  mirrors the site's own bar. Two links to the same wall a few
                  inches apart is the opposite of making it easy to find.
                */}
                <Link
                  href="/admin"
                  className="text-graphite hover:text-accent text-xs transition-colors"
                >
                  Store
                </Link>
                <Link
                  href="/admin/settings"
                  className="text-graphite hover:text-accent text-xs transition-colors"
                >
                  Settings
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
              <Link href="/" className="text-graphite hover:text-accent text-xs transition-colors">
                View site
              </Link>
              {/*
                `flex` so the form is not a line box. As a block it lays the
                button out as inline content, which reserves room for a
                descender underneath and drops "Sign out" 1.5px below the link
                beside it.
              */}
              <form action={logout} className="flex">
                <button type="submit" className="text-graphite hover:text-accent text-xs">
                  Sign out
                </button>
              </form>
            </div>
          </Container>
        </div>
      )}
      {children}
    </div>
  );
}
