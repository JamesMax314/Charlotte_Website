import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  firstText,
  jsonLdScriptContent,
  metaDescription,
  personJsonLd,
  profileLinks,
  siteOpenGraph,
  socialImage,
  visualArtworkJsonLd,
  webSiteJsonLd,
} from "./seo";
import { SITE_URL } from "./site";

describe("absoluteUrl", () => {
  it("resolves the home page to the bare origin", () => {
    // Next resolves a "/" path to the origin with no trailing slash, and
    // sitemap.ts emits SITE_URL bare. All three must agree.
    expect(absoluteUrl("/")).toBe(SITE_URL);
    expect(absoluteUrl("/")).not.toMatch(/\/$/);
  });

  it("joins a path without doubling the slash", () => {
    expect(absoluteUrl("/about")).toBe(`${SITE_URL}/about`);
    expect(absoluteUrl("about")).toBe(`${SITE_URL}/about`);
  });

  it("leaves an already absolute URL alone", () => {
    expect(absoluteUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});

describe("firstText", () => {
  it("takes the first candidate with something in it", () => {
    expect(firstText("", "   ", null, undefined, "third")).toBe("third");
  });

  it("is empty when nothing has anything", () => {
    expect(firstText("", null, undefined)).toBe("");
  });
});

describe("metaDescription", () => {
  it("collapses the whitespace of copy written in paragraphs", () => {
    expect(metaDescription("One line.\n\nAnd   another.")).toBe("One line. And another.");
  });

  it("leaves anything short enough exactly as it is", () => {
    expect(metaDescription("Short enough.")).toBe("Short enough.");
  });

  it("cuts at a word boundary, never mid-word", () => {
    const source = `${"word ".repeat(60)}end`;
    const cut = metaDescription(source, 40);

    expect(cut.length).toBeLessThanOrEqual(41); // the ellipsis is one character
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.replace("…", "").trim().split(" ").at(-1)).toBe("word");
  });

  it("does not leave a dangling comma against the ellipsis", () => {
    expect(metaDescription("Illustration, printmaking, and more words", 18)).toBe("Illustration…");
  });

  it("adds no ellipsis when it did not cut", () => {
    expect(metaDescription("Exactly this", 12)).toBe("Exactly this");
  });
});

describe("profileLinks", () => {
  it("drops the placeholder links the settings fallback ships", () => {
    // SETTINGS_FALLBACK in catalogue.ts carries these two until the artist
    // replaces them. Publishing them as sameAs would claim she is Instagram.
    expect(profileLinks("https://www.instagram.com/", "https://www.etsy.com/")).toEqual([]);
  });

  it("keeps a link that names an actual account", () => {
    expect(profileLinks("https://www.instagram.com/charlotte")).toEqual([
      "https://www.instagram.com/charlotte",
    ]);
  });

  it("drops empties, nulls and anything that is not http", () => {
    expect(profileLinks("", null, undefined, "javascript:alert(1)", "not a url")).toEqual([]);
  });
});

describe("socialImage", () => {
  const siteName = "Charlotte Wilkinson";

  it("prefers the page's own artwork, at a ladder rung", () => {
    const { image, card } = socialImage({
      siteName,
      page: { src: "/media/portfolio/abc.jpg", alt: "A map", width: 2400, height: 1600 },
      shareImageKey: "site/share.jpg",
      faviconKey: "site/mark.png",
    });

    expect(image.url).toBe(`${SITE_URL}/media/portfolio/abc-1600.jpg`);
    expect(image.alt).toBe("A map");
    expect(card).toBe("summary_large_image");
  });

  it("falls back to the artist's share image, at its base key", () => {
    const { image, card } = socialImage({
      siteName,
      shareImageKey: "site/share.jpg",
      shareImageWidth: 1200,
      shareImageHeight: 630,
      faviconKey: "site/mark.png",
    });

    expect(image.url).toBe(`${SITE_URL}/media/site/share.jpg`);
    expect(image).toMatchObject({ width: 1200, height: 630 });
    expect(card).toBe("summary_large_image");
  });

  it("falls back to the mark, and says the card is a small one", () => {
    // The artist asked for her favicon. A square mark in a 1.91:1 card is
    // cropped or letterboxed, so the shape is declared honestly instead.
    const { image, card } = socialImage({ siteName, faviconKey: "site/mark.png" });

    expect(image.url).toBe(`${SITE_URL}/media/site/mark.png`);
    expect(image.width).toBeUndefined();
    expect(card).toBe("summary");
  });

  it("falls back to a raster, never to the drawn SVG", () => {
    const { image, card } = socialImage({ siteName });

    expect(image.url).toBe(`${SITE_URL}/og-default.png`);
    expect(image.url.endsWith(".svg")).toBe(false);
    expect(image).toMatchObject({ width: 1200, height: 630 });
    expect(card).toBe("summary_large_image");
  });
});

describe("siteOpenGraph", () => {
  it("carries the whole card, because a page's block replaces the layout's", () => {
    const og = siteOpenGraph({
      title: "A piece",
      path: "/work/a-piece",
      siteName: "Charlotte Wilkinson",
      image: { url: "https://example.com/x.jpg", alt: "x" },
      type: "article",
    });

    expect(og).toMatchObject({
      type: "article",
      siteName: "Charlotte Wilkinson",
      locale: "en_GB",
      url: `${SITE_URL}/work/a-piece`,
    });
  });
});

describe("structured data", () => {
  it("omits everything the artist has not filled in, rather than emitting nulls", () => {
    const person = personJsonLd({ name: "Charlotte Wilkinson" });

    expect(person).toEqual({
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: "Charlotte Wilkinson",
      url: SITE_URL,
    });
  });

  it("carries the name variants and topics when there are some", () => {
    const person = personJsonLd({
      name: "Charlotte Wilkinson",
      alternateNames: ["CJW"],
      knowsAbout: ["Printmaking"],
      sameAs: ["https://www.instagram.com/charlotte"],
    });

    expect(person).toMatchObject({
      alternateName: ["CJW"],
      knowsAbout: ["Printmaking"],
      sameAs: ["https://www.instagram.com/charlotte"],
    });
  });

  it("points the site at the artist by id, so she is described once", () => {
    expect(webSiteJsonLd({ name: "Charlotte Wilkinson" })).toMatchObject({
      publisher: { "@id": `${SITE_URL}/#person` },
    });
  });

  it("never describes an artwork as something for sale", () => {
    // Brief N-03: Etsy is the seller. Claiming an offer we cannot honour is
    // what earns a structured-data penalty.
    const serialised = JSON.stringify(
      visualArtworkJsonLd({
        name: "A piece",
        path: "/shop/a-piece",
        creatorName: "Charlotte Wilkinson",
        artform: "Screenprint",
        dateCreated: "2024",
        imageUrl: "https://example.com/x.jpg",
      }),
    );

    for (const banned of ["offers", "Offer", "Product", "price", "availability", "Rating"]) {
      expect(serialised).not.toContain(banned);
    }
  });

  it("numbers a breadcrumb from one and makes every step absolute", () => {
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
    ]) as { itemListElement: { position: number; item: string }[] };

    expect(crumbs.itemListElement.map((step) => step.position)).toEqual([1, 2]);
    expect(crumbs.itemListElement[0].item).toBe(SITE_URL);
    expect(crumbs.itemListElement[1].item).toBe(`${SITE_URL}/shop`);
  });
});

describe("jsonLdScriptContent", () => {
  it("cannot break out of the script element it is written into", () => {
    const hostile = "</script><img src=x onerror=alert(1)>";
    const content = jsonLdScriptContent([
      visualArtworkJsonLd({ name: hostile, path: "/x", creatorName: "C" }),
    ]);

    expect(content).not.toContain("</script");
    expect(content).not.toContain("<");

    // Still the same string once parsed: escaped, not stripped.
    const parsed = JSON.parse(content) as { "@graph": { name: string }[] };
    expect(parsed["@graph"][0].name).toBe(hostile);
  });

  it("wraps the nodes in one graph with one context", () => {
    const parsed = JSON.parse(jsonLdScriptContent([{ "@type": "Person" }, { "@type": "WebSite" }]));

    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]).toHaveLength(2);
  });
});
