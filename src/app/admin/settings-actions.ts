"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/catalogue";
import { getDb } from "@/lib/db";
import { releaseMedia } from "@/lib/publish";
import { cssFamilyName, isKnownFontId, mergeFonts, newFontId, type FontFormat } from "@/lib/fonts";
import { headerStyle, type HeaderStyle } from "@/lib/header-style";
import { getSiteFonts, upsertSiteSettings } from "@/lib/site-settings";
import { docToPlain, sanitiseDoc, serialiseDoc } from "@/lib/rich-text";
import { normaliseSettings, type SettingsInput } from "@/lib/settings-input";
import { isSafeKey } from "@/lib/storage";

/**
 * Site settings mutations.
 *
 * As everywhere else in the admin, every entry point gates itself: actions are
 * routed independently of layouts, so the layout's session check protects
 * pages only.
 */

const refresh = () => revalidatePath("/", "layout");

/**
 * Removes an asset and the ladder rungs beside it.
 *
 * Guarded on the key actually changing, because keys are content-addressed:
 * re-uploading identical bytes yields the same key, and an unguarded delete
 * would destroy the object it had just written.
 */
async function discardAsset(previous: string | null, next: string | null): Promise<void> {
  if (!previous || previous === next) return;
  await releaseMedia([previous]);
}

/** The mark, in the header and the browser tab. Null clears it back to the drawn SVG. */
export async function setFavicon(key: string | null): Promise<void> {
  await requireSession();
  if (key !== null && !isSafeKey(key)) throw new Error("That mark could not be stored.");

  const current = await getSiteSettings();
  await upsertSiteSettings({ faviconKey: key });
  await discardAsset(current.faviconKey, key);
  refresh();
}

export interface AboutPhoto {
  key: string;
  width: number;
  height: number;
  lqip: string;
}

/** The photograph beside the About copy. Null removes it. */
export async function setAboutPhoto(photo: AboutPhoto | null): Promise<void> {
  await requireSession();
  if (photo !== null && !isSafeKey(photo.key)) {
    throw new Error("That photograph could not be stored.");
  }

  const current = await getSiteSettings();
  await upsertSiteSettings({
    aboutPhotoKey: photo?.key ?? null,
    aboutPhotoWidth: photo?.width ?? null,
    aboutPhotoHeight: photo?.height ?? null,
    aboutPhotoLqip: photo?.lqip ?? null,
    // A removed photo takes its description with it; a new one starts blank so
    // the artist is prompted rather than inheriting a description of a
    // different picture.
    aboutPhotoAlt: "",
  });
  await discardAsset(current.aboutPhotoKey, photo?.key ?? null);
  refresh();
}

export interface ShareImage {
  key: string;
  width: number;
  height: number;
}

/**
 * The picture a shared link shows. Null clears it back to the mark.
 *
 * Kept apart from the mark deliberately: a link preview is 1.91:1 and a mark is
 * square, so one file cannot be both. Guarded on the key changing for the same
 * reason `setAboutPhoto` is — keys are content-addressed, so re-uploading the
 * same bytes returns the same key and an unguarded delete would destroy the
 * object it had just written.
 */
export async function setShareImage(image: ShareImage | null): Promise<void> {
  await requireSession();
  if (image !== null && !isSafeKey(image.key)) {
    throw new Error("That picture could not be stored.");
  }

  const current = await getSiteSettings();
  await upsertSiteSettings({
    shareImageKey: image?.key ?? null,
    shareImageWidth: image?.width ?? null,
    shareImageHeight: image?.height ?? null,
  });
  await discardAsset(current.shareImageKey, image?.key ?? null);
  refresh();
}

/**
 * The highlight colour.
 *
 * Separate from `updateSiteSettings` because it saves on its own rhythm — the
 * whole admin repaints with it, so it commits as the artist leaves the picker
 * rather than behind the section's Save button.
 */
export async function setAccentColour(hex: string): Promise<void> {
  await requireSession();

  const { values, rejected } = normaliseSettings({ accentColour: hex });
  if (rejected.length > 0) throw new Error("That is not a colour.");

  await upsertSiteSettings(values);
  refresh();
}

/**
 * The two faces the public site is set in.
 *
 * Separate from `saveSettingsForm` for the same reason as `setAccentColour`:
 * a discrete choice with a live surface, saved as she makes it.
 *
 * The guard has to read the database, exactly like `updateWallText` — the valid
 * set is the built-ins plus her uploads, which `normaliseSettings` cannot see
 * because it is pure. Unlike the wall this rejects rather than silently
 * dropping: a settings page left open in another tab can still name a font she
 * has since deleted, and she has to be told why nothing moved.
 */
/**
 * The top bar's proportions.
 *
 * Saves on change rather than behind the section's Save button: the preview
 * beside the sliders is a live surface, and an unsaved value would leave it
 * showing something the site is not. The same case as the highlight colour and
 * the wall's page settings.
 *
 * Clamped through `headerStyle`, which is what the preview draws from too — so
 * a hand-crafted request cannot reach a value the artist could never have seen.
 */
export async function setHeaderStyle(patch: Partial<HeaderStyle>): Promise<void> {
  await requireSession();

  const current = await getSiteSettings();
  const next = headerStyle({
    height: patch.height ?? current.headerHeight,
    nameSize: patch.nameSize ?? current.headerNameSize,
    navSize: patch.navSize ?? current.headerNavSize,
    contentSpace: patch.contentSpace ?? current.contentSpace,
  });

  await upsertSiteSettings({
    headerHeight: next.height,
    headerNameSize: next.nameSize,
    headerNavSize: next.navSize,
    contentSpace: next.contentSpace,
  });
  refresh();
}

export async function setSiteFaces(patch: {
  bodyFontId?: string;
  headingFontId?: string;
}): Promise<void> {
  await requireSession();

  const registry = mergeFonts(await getSiteFonts());
  const values: { bodyFontId?: string; headingFontId?: string } = {};

  for (const key of ["bodyFontId", "headingFontId"] as const) {
    const id = patch[key];
    if (id === undefined) continue;
    if (!isKnownFontId(id, registry)) throw new Error("That font is no longer available.");
    values[key] = id;
  }

  // upsertSiteSettings no-ops on an empty patch, so a call with neither is free.
  await upsertSiteSettings(values);
  refresh();
}

/** Adds an uploaded font to the list offered for wall text. */
export async function addSiteFont(input: {
  label: string;
  storageKey: string;
  format: FontFormat;
}): Promise<void> {
  await requireSession();
  if (!isSafeKey(input.storageKey)) throw new Error("That font could not be stored.");

  const db = await getDb();
  await db.insert(schema.siteFonts).values({
    id: newFontId(),
    label: cssFamilyName(input.label),
    family: cssFamilyName(input.label),
    storageKey: input.storageKey,
    format: input.format,
  });

  refresh();
}

/**
 * Removes an uploaded font.
 *
 * Deliberately leaves `wall_texts` alone. A text box keeps the id it was given
 * and `resolveFontFamily` falls back to Inter — the exact case that fallback
 * was written for. Sweeping the table would be a migration that could not be
 * undone if the artist re-uploaded the same face.
 */
export async function deleteSiteFont(id: string): Promise<void> {
  await requireSession();

  const db = await getDb();
  const rows = await db
    .select({ storageKey: schema.siteFonts.storageKey })
    .from(schema.siteFonts)
    .where(eq(schema.siteFonts.id, id))
    .limit(1);

  await db.delete(schema.siteFonts).where(eq(schema.siteFonts.id, id));

  await releaseMedia([rows[0]?.storageKey]);

  refresh();
}

export interface SettingsFormState {
  status: "idle" | "saved" | "error";
  /** Field labels the artist typed that could not be stored. */
  rejected: string[];
}

const FIELDS = [
  "siteName",
  "siteDescription",
  "instagramUrl",
  "etsyShopUrl",
  "contactEmail",
  "aboutCopy",
  "aboutPhotoAlt",
  "contactCopy",
  "privacyCopy",
] as const;

/**
 * The form-shaped entry point, shared by every section with a Save button.
 *
 * Reads only the fields a form actually submitted, so each section saves its
 * own without clearing the others. Returns what it rejected rather than
 * dropping it silently: that is right for a colour picker, which cannot
 * produce an invalid value, and wrong for an address the artist typed.
 */
export async function saveSettingsForm(
  _previous: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  await requireSession();

  const patch: SettingsInput = {};
  for (const field of FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") patch[field] = value;
  }

  const { values, rejected } = normaliseSettings(patch);

  /*
    The three page-copy fields arrive as rich documents in a hidden input. Each
    writes its JSON column and its plain mirror from the same document, so the
    two can never disagree — the mirror is what the page falls back to if the
    JSON ever fails to parse, and what search engines and OG cards read.

    Sanitised here rather than trusted from the browser: a server action is a
    public endpoint, and the editor's output is a suggestion.
  */
  const fonts = mergeFonts(await getSiteFonts());
  const richPairs = [
    ["aboutRich", "aboutCopy"],
    ["contactRich", "contactCopy"],
    ["privacyRich", "privacyCopy"],
  ] as const;

  const richValues: Record<string, string> = {};
  for (const [richField, plainField] of richPairs) {
    const raw = form.get(richField);
    if (typeof raw !== "string") continue;
    let doc;
    try {
      doc = sanitiseDoc(JSON.parse(raw), fonts);
    } catch {
      continue;
    }
    richValues[richField] = serialiseDoc(doc);
    richValues[plainField] = docToPlain(doc);
  }

  await upsertSiteSettings({ ...values, ...richValues });
  refresh();

  return { status: rejected.length > 0 ? "error" : "saved", rejected };
}
