import type { Metadata } from "next";
import { Container } from "@/components/container";
import { getSiteSettings } from "@/lib/catalogue";
import { toParagraphs } from "@/lib/copy";
import { DEFAULT_PRIVACY_COPY } from "@/lib/default-copy";

// The root layout's header and footer read site settings from D1, so this page
// cannot be prerendered without baking in stale settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this site collects, which is almost nothing.",
};

export default async function PrivacyPage() {
  const settings = await getSiteSettings();

  const written = toParagraphs(settings.privacyCopy);
  const body = written.length > 0 ? written : toParagraphs(DEFAULT_PRIVACY_COPY);

  return (
    <Container className="pt-16 pb-4">
      <div className="max-w-prose">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Privacy</h1>

        <div className="mt-6 space-y-5 leading-relaxed text-pretty">
          {body.map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </Container>
  );
}
