import type { Metadata } from "next";
import { Container } from "@/components/container";
import { AboutPhotoField } from "@/components/admin/about-photo-field";
import { AccentField } from "@/components/admin/accent-field";
import { ShareImageField } from "@/components/admin/share-image-field";
import { FaviconField } from "@/components/admin/favicon-field";
import { HeaderStyleField } from "@/components/admin/header-style-field";
import { RichCopyField } from "@/components/admin/rich-copy-field";
import { FontsField } from "@/components/admin/fonts-field";
import { SiteFacesField } from "@/components/admin/site-faces-field";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsSection } from "@/components/admin/settings-section";
import { FIELD } from "@/components/admin/styles";
import { requireSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/catalogue";
import { DEFAULT_ABOUT_COPY, DEFAULT_CONTACT_COPY, DEFAULT_PRIVACY_COPY } from "@/lib/default-copy";
import { mergeFonts, resolveSiteFaces } from "@/lib/fonts";
import { headerStyleFromSettings } from "@/lib/header-style";
import { copyDoc } from "@/lib/rich-text";
import { navLabel } from "@/lib/site-pages";
import { getAllSitePages } from "@/lib/site-pages-queries";
import { getSiteFonts } from "@/lib/site-settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-graphite text-xs">{children}</span>
);

export default async function SettingsPage() {
  await requireSession();
  const [settings, fonts, pages] = await Promise.all([
    getSiteSettings(),
    getSiteFonts(),
    getAllSitePages(),
  ]);
  const registry = mergeFonts(fonts);

  return (
    <Container className="pt-10 pb-20">
      <h1 className="font-display text-3xl tracking-tight">Settings</h1>
      <p className="text-graphite mt-1 mb-10 text-sm">
        Your name and mark, where you link out to, and the words on your About and Privacy pages.
      </p>

      <SettingsForm title="Your name and mark" hint="Shown together at the top of every page.">
        <FaviconField faviconKey={settings.faviconKey} />
        <label className="flex max-w-sm flex-col gap-1.5">
          <Label>Site name</Label>
          <input name="siteName" defaultValue={settings.siteName} className={FIELD} />
        </label>
      </SettingsForm>

      <SettingsForm
        title="How the site appears in search and when it is shared"
        hint="The words under your name in Google, and the picture a shared link shows."
      >
        <label className="flex max-w-lg flex-col gap-1.5">
          <Label>Description</Label>
          <textarea
            name="siteDescription"
            defaultValue={settings.siteDescription}
            rows={3}
            className={FIELD}
          />
          <span className="text-graphite text-xs">
            One sentence, around 25 words. Say what you make and who for — these are the words
            someone reads before deciding whether to click.
          </span>
        </label>

        <ShareImageField
          imageKey={settings.shareImageKey}
          width={settings.shareImageWidth}
          height={settings.shareImageHeight}
        />
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
        title="The top bar"
        hint="How tall it is, how large your name and the links are set, and how much room your work has beneath it. Everything here shows in the preview as you drag."
      >
        <HeaderStyleField
          initial={headerStyleFromSettings(settings)}
          siteName={settings.siteName}
          faviconKey={settings.faviconKey}
          // Only her published pages: the miniature is what a visitor sees.
          pageLabels={pages.filter((p) => p.status === "published").map(navLabel)}
          // Resolved and passed in, because the studio deliberately does not
          // render in her chosen faces — see src/app/(site)/layout.tsx.
          displayFamily={resolveSiteFaces(settings, registry).display}
        />
      </SettingsSection>

      <SettingsSection
        title="Look"
        hint="How your site is set. The highlight colour applies here in the studio too; the fonts deliberately do not, so this stays easy to work in."
      >
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="mb-3 text-sm">Highlight colour</h3>
            <AccentField accentColour={settings.accentColour} />
          </div>
          {/* The library sits above the thing that consumes it: upload, then choose. */}
          <div>
            <h3 className="mb-3 text-sm">Your fonts</h3>
            <FontsField
              fonts={fonts}
              bodyFontId={settings.bodyFontId}
              headingFontId={settings.headingFontId}
            />
          </div>
          <div>
            <h3 className="mb-3 text-sm">Site typefaces</h3>
            <SiteFacesField
              bodyFontId={settings.bodyFontId}
              headingFontId={settings.headingFontId}
              fonts={registry}
              uploaded={fonts}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsForm
        title="About page"
        hint="Your words, and the contact details that sit beneath them. A blank line starts a new paragraph."
      >
        <AboutPhotoField
          photoKey={settings.aboutPhotoKey}
          width={settings.aboutPhotoWidth}
          height={settings.aboutPhotoHeight}
          lqip={settings.aboutPhotoLqip}
          alt={settings.aboutPhotoAlt}
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
        <RichCopyField
          name="aboutRich"
          label="Your words"
          initial={copyDoc(settings.aboutRich, settings.aboutCopy, DEFAULT_ABOUT_COPY, registry)}
          fonts={registry}
        />

        {/*
          Contact is part of the About page now, so it is edited in the same
          box and saved by the same button. `saveSettingsForm` reads only the
          fields a form actually submitted, so moving these here needed nothing
          on the action's side — but it does mean these two now save together
          with the words above them.
        */}
        <div className="border-line mt-2 flex flex-col gap-4 border-t pt-6">
          <h3 className="text-sm">Contact, shown below your words</h3>
          <label className="flex max-w-lg flex-col gap-1.5">
            <Label>Email address — leave empty for no button</Label>
            <input
              name="contactEmail"
              type="email"
              inputMode="email"
              defaultValue={settings.contactEmail}
              className={FIELD}
            />
          </label>
          <RichCopyField
            name="contactRich"
            label="Your words about getting in touch"
            initial={copyDoc(
              settings.contactRich,
              settings.contactCopy,
              DEFAULT_CONTACT_COPY,
              registry,
            )}
            fonts={registry}
          />
        </div>
      </SettingsForm>

      <SettingsForm
        title="Privacy page"
        hint="What the site collects, which is almost nothing. A blank line starts a new paragraph."
      >
        <RichCopyField
          name="privacyRich"
          label="Your words"
          initial={copyDoc(
            settings.privacyRich,
            settings.privacyCopy,
            DEFAULT_PRIVACY_COPY,
            registry,
          )}
          fonts={registry}
        />
      </SettingsForm>

      <p className="text-graphite max-w-prose text-xs">
        Leaving a page&rsquo;s words empty is fine — the page falls back to the text it came with,
        rather than showing nothing at all.
      </p>
    </Container>
  );
}
