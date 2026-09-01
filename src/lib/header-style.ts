/**
 * The proportions of the top bar, which the artist sets herself.
 *
 * Pure, and shared by three surfaces that must agree: the site layout emits
 * these as custom properties, the header consumes them, and the settings
 * preview renders a miniature from the same numbers. If the clamps lived in
 * the action instead, the preview could show her something the site would
 * never render.
 */

export interface HeaderStyle {
  /** A floor, not a fixed size. See `HEADER_LIMITS`. */
  height: number;
  /** The site name beside the mark. */
  nameSize: number;
  /** Every link in the bar — the artist's pages and the fixed ones alike. */
  navSize: number;
}

export const HEADER_DEFAULTS: HeaderStyle = { height: 76, nameSize: 18, navSize: 14 };

/**
 * The bounds each control moves between.
 *
 * The height floor is 56 rather than something smaller because the mark is a
 * fixed 36px and the bar keeps 8px of padding above and below it: below 52 the
 * mark would decide the height and the setting would quietly stop doing
 * anything. A control that silently has no effect is worse than one that
 * cannot reach the value.
 *
 * The name is capped well under the height ceiling for the same reason from
 * the other direction — see `exceedsHeight`.
 */
export const HEADER_LIMITS = {
  height: { min: 56, max: 180 },
  nameSize: { min: 12, max: 36 },
  navSize: { min: 10, max: 20 },
} as const;

const clamp = (value: number, { min, max }: { min: number; max: number }): number =>
  Math.min(Math.max(Math.round(value), min), max);

/** Coerces anything stored or submitted into a style the header can render. */
export const headerStyle = (raw: Partial<HeaderStyle> | null | undefined): HeaderStyle => ({
  height: clamp(raw?.height ?? HEADER_DEFAULTS.height, HEADER_LIMITS.height),
  nameSize: clamp(raw?.nameSize ?? HEADER_DEFAULTS.nameSize, HEADER_LIMITS.nameSize),
  navSize: clamp(raw?.navSize ?? HEADER_DEFAULTS.navSize, HEADER_LIMITS.navSize),
});

/**
 * The style stored on the settings row.
 *
 * The columns are prefixed (`header_height`) and the style is not (`height`),
 * so this is the one place the two vocabularies meet. Callers pass the whole
 * settings object and never assemble the three fields themselves.
 */
export const headerStyleFromSettings = (settings: {
  headerHeight: number;
  headerNameSize: number;
  headerNavSize: number;
}): HeaderStyle =>
  headerStyle({
    height: settings.headerHeight,
    nameSize: settings.headerNameSize,
    navSize: settings.headerNavSize,
  });

/**
 * Roughly how tall the bar's content wants to be, in pixels.
 *
 * The mark is 36 and the bar keeps 8px above and below it; a line of type
 * needs about 1.4x its size. Whichever of the two is taller decides.
 */
export const contentHeight = (style: HeaderStyle): number =>
  Math.max(36, Math.ceil(style.nameSize * 1.4), Math.ceil(style.navSize * 1.4)) + 16;

/**
 * Whether the type has outgrown the height the artist chose.
 *
 * `height` is a `min-height`, so the bar grows rather than clipping her name —
 * which is the right failure, but it makes the height control look broken.
 * The settings panel says so in words instead of leaving her to wonder.
 */
export const exceedsHeight = (style: HeaderStyle): boolean => contentHeight(style) > style.height;

/** What the bar will actually measure, given that height is only a floor. */
export const renderedHeight = (style: HeaderStyle): number =>
  Math.max(style.height, contentHeight(style));

/**
 * The custom properties the header reads.
 *
 * Returned as a plain record so the same values can go into the site layout's
 * `<style>` and into the preview's inline `style` — the preview scopes them to
 * itself, because the studio must not repaint in the artist's header settings.
 */
export const headerTokens = (style: HeaderStyle): Record<string, string> => ({
  "--header-height": `${style.height}px`,
  "--header-name-size": `${style.nameSize}px`,
  "--header-nav-size": `${style.navSize}px`,
});

/** The same properties as a CSS declaration body, for the layout's `<style>`. */
export const headerTokenCss = (style: HeaderStyle): string =>
  Object.entries(headerTokens(style))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
