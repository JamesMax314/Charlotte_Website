import { describe, expect, it } from "vitest";
import {
  contentHeight,
  exceedsHeight,
  HEADER_DEFAULTS,
  HEADER_LIMITS,
  headerStyle,
  headerTokenCss,
  headerStyleFromSettings,
  headerTokens,
  renderedHeight,
} from "./header-style";

describe("headerStyle", () => {
  it("passes through a style already in range", () => {
    expect(headerStyle({ height: 90, nameSize: 22, navSize: 13, contentSpace: 40 })).toEqual({
      height: 90,
      nameSize: 22,
      navSize: 13,
      contentSpace: 40,
    });
  });

  /**
   * The clamps live here rather than in the action because the settings
   * preview calls the same function: a value the preview would draw and the
   * site would refuse is the one bug this arrangement exists to prevent.
   */
  it("clamps every field to its bounds", () => {
    const low = headerStyle({ height: -50, nameSize: 0, navSize: 1, contentSpace: -300 });
    expect(low).toEqual({
      height: HEADER_LIMITS.height.min,
      nameSize: HEADER_LIMITS.nameSize.min,
      navSize: HEADER_LIMITS.navSize.min,
      contentSpace: HEADER_LIMITS.contentSpace.min,
    });

    const high = headerStyle({ height: 9000, nameSize: 400, navSize: 99, contentSpace: 9000 });
    expect(high).toEqual({
      height: HEADER_LIMITS.height.max,
      nameSize: HEADER_LIMITS.nameSize.max,
      navSize: HEADER_LIMITS.navSize.max,
      contentSpace: HEADER_LIMITS.contentSpace.max,
    });
  });

  it("rounds, so a fractional value cannot reach the stylesheet", () => {
    expect(
      headerStyle({ height: 76.6, nameSize: 18.2, navSize: 14.5, contentSpace: 63.4 }),
    ).toEqual({ height: 77, nameSize: 18, navSize: 15, contentSpace: 63 });
  });

  it("falls back to the defaults for anything missing", () => {
    expect(headerStyle(null)).toEqual(HEADER_DEFAULTS);
    expect(headerStyle({ height: 100 }).nameSize).toBe(HEADER_DEFAULTS.nameSize);
  });

  /**
   * The floor exists so the height control always does something: the mark is
   * a fixed 36px inside 16px of padding, so anything under 52 would be
   * overridden by the mark and the slider would appear dead.
   */
  it("keeps the minimum height above what the mark alone occupies", () => {
    expect(HEADER_LIMITS.height.min).toBeGreaterThanOrEqual(52);
  });
});

describe("headerStyleFromSettings", () => {
  // The columns are prefixed and the style is not; this is the only place the
  // two vocabularies meet, so a swapped pair would be silent everywhere else.
  it("maps the prefixed columns onto the style", () => {
    expect(
      headerStyleFromSettings({
        headerHeight: 90,
        headerNameSize: 24,
        headerNavSize: 16,
        contentSpace: 48,
      }),
    ).toEqual({ height: 90, nameSize: 24, navSize: 16, contentSpace: 48 });
  });

  it("clamps what it reads, so a hand-edited row cannot reach the stylesheet", () => {
    expect(
      headerStyleFromSettings({
        headerHeight: 5000,
        headerNameSize: 2,
        headerNavSize: 900,
        contentSpace: -1,
      }),
    ).toEqual({
      height: HEADER_LIMITS.height.max,
      nameSize: HEADER_LIMITS.nameSize.min,
      navSize: HEADER_LIMITS.navSize.max,
      contentSpace: HEADER_LIMITS.contentSpace.min,
    });
  });
});

describe("exceedsHeight", () => {
  it("is false at the defaults", () => {
    expect(exceedsHeight(HEADER_DEFAULTS)).toBe(false);
  });

  /**
   * `height` is a min-height, so large type grows the bar rather than being
   * clipped. That is the right failure and the wrong-looking one — the panel
   * needs to be able to say it out loud.
   */
  it("is true when the name has outgrown the chosen height", () => {
    const style = headerStyle({ height: 56, nameSize: 36, navSize: 14 });
    expect(exceedsHeight(style)).toBe(true);
    expect(renderedHeight(style)).toBeGreaterThan(style.height);
  });

  it("reports the chosen height when the type fits inside it", () => {
    const style = headerStyle({ height: 120, nameSize: 18, navSize: 14 });
    expect(renderedHeight(style)).toBe(120);
    expect(contentHeight(style)).toBeLessThanOrEqual(120);
  });
});

describe("contentSpace", () => {
  /**
   * The artist asked for the gap above her work and the gap below it to match.
   * One field is what guarantees that: two would only ever be used to make
   * them disagree, and the layout applies this single value to both ends.
   */
  it("is one number, and zero is a legitimate value rather than a mistake", () => {
    expect(HEADER_LIMITS.contentSpace.min).toBe(0);
    expect(headerStyle({ contentSpace: 0 }).contentSpace).toBe(0);
  });

  it("is emitted as a single token, so both ends cannot drift apart", () => {
    const tokens = headerTokens(headerStyle({ contentSpace: 96 }));
    expect(tokens["--content-space"]).toBe("96px");
    expect(Object.keys(tokens).filter((k) => k.includes("space"))).toHaveLength(1);
  });
});

describe("headerTokens", () => {
  it("emits pixel values for the three properties the header reads", () => {
    expect(headerTokens({ height: 80, nameSize: 20, navSize: 12, contentSpace: 48 })).toEqual({
      "--header-height": "80px",
      "--header-name-size": "20px",
      "--header-nav-size": "12px",
      "--content-space": "48px",
    });
  });

  // The layout interpolates this into a <style> element, so a stray brace or
  // angle bracket would have to come from a number that was never a number.
  it("serialises to a declaration body with no markup in it", () => {
    const css = headerTokenCss(
      headerStyle({ height: 80, nameSize: 20, navSize: 12, contentSpace: 48 }),
    );
    expect(css).toBe(
      "--header-height:80px;--header-name-size:20px;--header-nav-size:12px;--content-space:48px",
    );
    expect(css).not.toMatch(/[<>{}]/);
  });
});
