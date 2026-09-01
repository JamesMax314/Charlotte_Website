import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { NavPages } from "@/components/admin/nav-pages";
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
  // Only once signed in: this read is gated on the session rather than run
  // unconditionally, so the login page still renders if D1 is unreachable.
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
              <Link href="/admin/portfolio" className="font-display text-sm tracking-tight">
                Studio
              </Link>
              <Link
                href="/admin/portfolio"
                className="text-graphite hover:text-accent text-xs transition-colors"
              >
                Home page
              </Link>
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

            {/*
              Always rendered, even with no pages yet — it holds the + that
              creates the first one, and it keeps the middle column occupied so
              the right-hand controls stay at the end of the bar.
            */}
            <div className="order-last w-full md:order-none md:w-auto md:justify-self-center">
              <NavPages pages={pages} />
            </div>

            <div className="flex items-center gap-4 md:justify-self-end">
              <Link href="/" className="text-graphite hover:text-accent text-xs transition-colors">
                View site
              </Link>
              <form action={logout}>
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
