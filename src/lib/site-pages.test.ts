import { describe, expect, it } from "vitest";
import { isReservedPageSlug, navLabel, RESERVED_PAGE_SLUGS, type SitePage } from "./site-pages";

const page = (over: Partial<SitePage>): SitePage => ({
  id: "p",
  slug: "exhibitions",
  title: "Exhibitions",
  status: "published",
  navOrder: 0,
  ...over,
});

describe("isReservedPageSlug", () => {
  /**
   * Custom pages live at the top level, so they share a namespace with the
   * site's own routes. Next resolves a static segment first, which means a
   * page slugged `about` is not a conflict the artist would ever see — it is a
   * page she can edit and never visit.
   */
  it("rejects the names the site's own routes already hold", () => {
    for (const slug of ["about", "contact", "privacy", "shop", "work", "admin"]) {
      expect(isReservedPageSlug(slug)).toBe(true);
    }
  });

  it("allows an ordinary page name", () => {
    expect(isReservedPageSlug("exhibitions")).toBe(false);
    expect(isReservedPageSlug("studio-notes")).toBe(false);
  });

  // The slug arriving from a form is whatever was typed into the field.
  it("ignores case and surrounding space", () => {
    expect(isReservedPageSlug("  Shop  ")).toBe(true);
  });

  /**
   * `/work/<slug>` and `/shop/<slug>` are two segments, so nothing stops a
   * page from being named after a piece — only after the section itself.
   */
  it("reserves the section, not the pieces inside it", () => {
    expect(RESERVED_PAGE_SLUGS.has("work")).toBe(true);
    expect(isReservedPageSlug("harbour-light")).toBe(false);
  });
});

describe("navLabel", () => {
  it("uses the page's title", () => {
    expect(navLabel(page({ title: "Exhibitions" }))).toBe("Exhibitions");
  });

  /**
   * An untitled page still has to be clickable in the studio, or there is no
   * way back into the editor to give it a name.
   */
  it("falls back to a placeholder rather than an empty link", () => {
    expect(navLabel(page({ title: "" }))).not.toBe("");
    expect(navLabel(page({ title: "   " }))).not.toBe("");
  });
});
