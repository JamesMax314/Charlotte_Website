import type { Metadata } from "next";
import { Container } from "@/components/container";
import { RichTextBlocks } from "@/components/rich-text";
import { mergeFonts } from "@/lib/fonts";
import { copyDoc } from "@/lib/rich-text";
import { getSiteFonts } from "@/lib/site-settings";
import { getSiteSettings } from "@/lib/catalogue";
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

  const [fonts] = await Promise.all([getSiteFonts()]);
  const registry = mergeFonts(fonts);
  const body = copyDoc(settings.privacyRich, settings.privacyCopy, DEFAULT_PRIVACY_COPY, registry);

  return (
    <Container>
      <div className="max-w-prose">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Privacy</h1>

        <div className="mt-6 space-y-5 leading-none text-pretty">
          <RichTextBlocks doc={body} fonts={registry} className="whitespace-pre-line" />
        </div>
      </div>
    </Container>
  );
}
