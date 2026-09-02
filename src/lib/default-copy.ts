/**
 * The prose the three static pages shipped with.
 *
 * Used in two places, which is the point: as the settings fallback when D1 is
 * unreachable, and by the pages themselves when the artist has saved an empty
 * box. The stored columns are NOT NULL DEFAULT '', so an empty string spreads
 * *over* the settings fallback and the reader alone cannot cover this.
 *
 * Rendering nothing instead would turn a stray "select all, delete" into an
 * About page that is the single word "About", with no error and no way for a
 * visitor to tell it is broken.
 */

export const DEFAULT_ABOUT_COPY = `I am an illustrator working in collage, drawing and digital colour. Most of my work is commissioned: illustrated maps, interpretive panels, editorial spreads and sequences that have to be read as well as looked at.

A piece usually begins with research and reference, then gets built up in layers — drawn elements, photographed textures and typography arranged until the information reads in the right order.

Prints of selected pieces are sold through my Etsy shop, which handles payment, postage and returns. For commissions, please get in touch.`;

export const DEFAULT_CONTACT_COPY = `For commissions, exhibitions, or a question about a print that hasn’t sold out yet, email me directly.`;

export const DEFAULT_PRIVACY_COPY = `Nothing is sold on this site. Buying a print happens on Etsy, and Etsy’s privacy policy covers everything that happens there, including your payment and delivery details. This site never sees them.

Visits are counted using aggregate analytics that set no cookies and do not identify you. That is why there is no cookie banner.

If you email me, I keep the email so I can reply. Ask and I will delete it.`;

export const DEFAULT_SITE_NAME = "Charlotte Wilkinson";

/**
 * The sentence a search result shows, until the artist writes her own.
 *
 * Reads as prose rather than a list of terms, but it is deliberately built out
 * of the disciplines she wants to be found for — a description is one of the
 * few places those words do real work. The rest of that job is her copy, not
 * this constant: see the keyword note in docs/progress.md.
 */
export const DEFAULT_SITE_DESCRIPTION =
  "Illustration and printmaking by Charlotte Wilkinson — nature, people and children’s books. Original work, prints and commissions.";

/**
 * The other ways the artist's name is written.
 *
 * `alternateName` is the correct, non-spammy home for genuine name variants —
 * someone searching "cjw illustration" or "c wilkinson art" is looking for her.
 * They belong in structured data rather than scattered through body copy.
 */
export const DEFAULT_ALTERNATE_NAMES = [
  "Charlotte J Wilkinson",
  "C Wilkinson",
  "CJW",
  "Charlotte Wilkinson Art",
];

/** What she works on, for `knowsAbout`. Her list, in the wording schema.org expects. */
export const DEFAULT_TOPICS = [
  "Illustration",
  "Printmaking",
  "Nature illustration",
  "Children's book illustration",
  "Editorial illustration",
  "Design",
];

export const DEFAULT_JOB_TITLE = "Illustrator";
