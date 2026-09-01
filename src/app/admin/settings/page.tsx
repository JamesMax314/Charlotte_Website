import type { Metadata } from "next";
import { Container } from "@/components/container";
import { AboutPhotoField } from "@/components/admin/about-photo-field";
import { AccentField } from "@/components/admin/accent-field";
import { FaviconField } from "@/components/admin/favicon-field";
import { FontsField } from "@/components/admin/fonts-field";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsSection } from "@/components/admin/settings-section";
import { FIELD } from "@/components/admin/styles";
import { requireSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_ABOUT_COPY, DEFAULT_CONTACT_COPY, DEFAULT_PRIVACY_COPY } from "@/lib/default-copy";
import { getSiteFonts } from "@/lib/site-settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-graphite text-xs">{children}</span>
);

export default async function SettingsPage() {
  await requireSession();
  const [settings, fonts] = await Promise.all([getSiteSettings(), getSiteFonts()]);

  return (
    <Container className="pt-10 pb-20">
      <h1 className="font-display text-3xl tracking-tight">Settings</h1>
      <p className="text-graphite mt-1 mb-10 text-sm">
        Your name and mark, where you link out to, and the words on your About, Contact and Privacy
        pages.
      </p>

      <SettingsForm title="Your name and mark" hint="Shown together at the top of every page.">
        <FaviconField faviconKey={settings.faviconKey} />
        <label className="flex max-w-sm flex-col gap-1.5">
          <Label>Site name</Label>
          <input name="siteName" defaultValue={settings.siteName} className={FIELD} />
        </label>
      </SettingsForm>

      <SettingsForm
        title="Links"
        hint="Where the Shop link and the footer send visitors. Leave one empty to hide it."
      >
        <label className="flex max-w-lg flex-col gap-1.5">
          <Label>Instagram</Label>
          <input
            name="instagramUrl"
            type="url"
            inputMode="url"
            placeholder="https://www.instagram.com/…"
            defaultValue={settings.instagramUrl}
            className={FIELD}
          />
        </label>
        <label className="flex max-w-lg flex-col gap-1.5">
          <Label>Etsy shop</Label>
          <input
            name="etsyShopUrl"
            type="url"
            inputMode="url"
            placeholder="https://www.etsy.com/shop/…"
            defaultValue={settings.etsyShopUrl}
            className={FIELD}
          />
        </label>
      </SettingsForm>

      <SettingsSection
        title="Look"
        hint="Applies across the whole site, and here in the studio as you change it."
      >
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="mb-3 text-sm">Highlight colour</h3>
            <AccentField accentColour={settings.accentColour} />
          </div>
          <div>
            <h3 className="mb-3 text-sm">Fonts</h3>
            <FontsField fonts={fonts} />
          </div>
        </div>
      </SettingsSection>

      <SettingsForm title="About page" hint="A blank line starts a new paragraph.">
        <AboutPhotoField
          photoKey={settings.aboutPhotoKey}
          width={settings.aboutPhotoWidth}
          height={settings.aboutPhotoHeight}
        />
        {settings.aboutPhotoKey && (
          <label className="flex max-w-lg flex-col gap-1.5">
            <Label>Describe the photograph, for anyone who cannot see it</Label>
            <input
              name="aboutPhotoAlt"
              defaultValue={settings.aboutPhotoAlt}
              placeholder="Charlotte at her desk, working on a map"
              className={FIELD}
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <Label>Your words</Label>
          <textarea
            name="aboutCopy"
            rows={10}
            defaultValue={settings.aboutCopy}
            placeholder={DEFAULT_ABOUT_COPY}
            className={`${FIELD} leading-relaxed`}
          />
        </label>
      </SettingsForm>

      <SettingsForm title="Contact page" hint="A blank line starts a new paragraph.">
        <label className="flex max-w-lg flex-col gap-1.5">
          <Label>Email address</Label>
          <input
            name="contactEmail"
            type="email"
            inputMode="email"
            defaultValue={settings.contactEmail}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Your words</Label>
          <textarea
            name="contactCopy"
            rows={6}
            defaultValue={settings.contactCopy}
            placeholder={DEFAULT_CONTACT_COPY}
            className={`${FIELD} leading-relaxed`}
          />
        </label>
      </SettingsForm>

      <SettingsForm
        title="Privacy page"
        hint="What the site collects, which is almost nothing. A blank line starts a new paragraph."
      >
        <label className="flex flex-col gap-1.5">
          <Label>Your words</Label>
          <textarea
            name="privacyCopy"
            rows={10}
            defaultValue={settings.privacyCopy}
            placeholder={DEFAULT_PRIVACY_COPY}
            className={`${FIELD} leading-relaxed`}
          />
        </label>
      </SettingsForm>

      <p className="text-graphite max-w-prose text-xs">
        Leaving a page&rsquo;s words empty is fine — the page falls back to the text it came with,
        rather than showing nothing at all.
      </p>
    </Container>
  );
}
