import type { Metadata } from "next";
import { Caveat, Fraunces, IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Charlotte Wilkinson — illustration",
    template: "%s · Charlotte Wilkinson",
  },
  description:
    "Illustrated maps, editorial spreads and sequences by Charlotte Wilkinson. Selected prints available.",
};

/**
 * Document shell only. The public site and the admin have separate chrome —
 * see (site)/layout.tsx and admin/layout.tsx.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${fraunces.variable} ${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} ${caveat.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
