/**
 * Validation for everything the artist types on the settings page.
 *
 * Pure, so it is unit-tested without a binding — this repo has no harness for
 * route handlers or server actions, and every rule worth proving lives here
 * rather than in the action that calls it.
 */

import { normaliseHex } from "./colour";

/** Long enough for any of the three pages, short enough to bound a D1 row. */
export const MAX_COPY = 8000;
export const MAX_NAME = 80;
export const MAX_ALT = 300;
/** Past what a search result renders; long enough not to feel cramped. */
export const MAX_DESCRIPTION = 200;

/**
 * An outbound link, or null.
 *
 * The header and footer render these straight into `href`, so once they are
 * artist-editable an unvalidated value is stored XSS: `javascript:alert(1)`
 * in the Instagram field would run on every page of the site. Only http and
 * https survive, and a bare "instagram.com/her" is rejected rather than
 * guessed at — a link that silently resolves to the wrong place is worse than
 * one the artist is told to fix.
 */
export const safeExternalUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
};

/**
 * A contact address, or null.
 *
 * Deliberately loose — the aim is to catch a typed mistake and anything that
 * would break out of a `mailto:` href, not to adjudicate RFC 5322.
 */
export const safeEmail = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.length > 254) return null;
  if (/[\s<>"'`\\]/.test(trimmed)) return null;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed) ? trimmed : null;
};

const clampText = (input: string, max: number): string => input.trim().slice(0, max);

export interface SettingsInput {
  siteName?: string;
  siteDescription?: string;
  instagramUrl?: string;
  etsyShopUrl?: string;
  contactEmail?: string;
  accentColour?: string;
  aboutCopy?: string;
  aboutPhotoAlt?: string;
  contactCopy?: string;
  privacyCopy?: string;
}

export interface NormalisedSettings {
  values: SettingsInput;
  /** Field labels the artist typed that could not be stored. */
  rejected: string[];
}

/**
 * Cleans a settings patch, reporting what it had to drop.
 *
 * `rejected` exists so the action can say "that Instagram address didn't look
 * like a web address" rather than silently discarding it. Silent dropping is
 * right for a colour picker, which cannot produce an invalid value; it is
 * wrong for a field she typed by hand.
 *
 * Clearing a field is not a rejection: an empty box means "remove this", and
 * an artist with no Instagram must be able to say so.
 */
export const normaliseSettings = (raw: SettingsInput): NormalisedSettings => {
  const values: SettingsInput = {};
  const rejected: string[] = [];

  const url = (key: "instagramUrl" | "etsyShopUrl", label: string) => {
    const input = raw[key];
    if (input === undefined) return;
    if (input.trim() === "") {
      values[key] = "";
      return;
    }
    const safe = safeExternalUrl(input);
    if (safe === null) rejected.push(label);
    else values[key] = safe;
  };

  const copy = (key: "aboutCopy" | "contactCopy" | "privacyCopy") => {
    if (raw[key] !== undefined) values[key] = clampText(raw[key], MAX_COPY);
  };

  if (raw.siteName !== undefined) values.siteName = clampText(raw.siteName, MAX_NAME);
  if (raw.siteDescription !== undefined) {
    values.siteDescription = clampText(raw.siteDescription, MAX_DESCRIPTION);
  }
  if (raw.aboutPhotoAlt !== undefined) values.aboutPhotoAlt = clampText(raw.aboutPhotoAlt, MAX_ALT);

  url("instagramUrl", "Instagram address");
  url("etsyShopUrl", "Etsy shop address");

  if (raw.contactEmail !== undefined) {
    if (raw.contactEmail.trim() === "") {
      values.contactEmail = "";
    } else {
      const safe = safeEmail(raw.contactEmail);
      if (safe === null) rejected.push("Contact email");
      else values.contactEmail = safe;
    }
  }

  if (raw.accentColour !== undefined) {
    const safe = normaliseHex(raw.accentColour);
    if (safe === null) rejected.push("Highlight colour");
    else values.accentColour = safe;
  }

  copy("aboutCopy");
  copy("contactCopy");
  copy("privacyCopy");

  return { values, rejected };
};
