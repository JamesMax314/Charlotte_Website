import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";
import { hasValidSession } from "@/lib/auth";
import { logout } from "./actions";

// Admin must never be indexed, and never cached.
export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await hasValidSession();

  return (
    <div className="min-h-dvh">
      {signedIn && (
        <div className="border-line bg-paper-sunk border-b">
          <Container className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <Mark className="text-ink h-6 w-6" />
              <Link href="/admin" className="font-display text-sm tracking-tight">
                Studio
              </Link>
              <Link href="/" className="text-graphite hover:text-biro text-xs transition-colors">
                View site
              </Link>
            </div>
            <form action={logout}>
              <button type="submit" className="text-graphite hover:text-biro text-xs">
                Sign out
              </button>
            </form>
          </Container>
        </div>
      )}
      {children}
    </div>
  );
}
