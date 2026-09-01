import { describe, expect, it } from "vitest";
import { MAX_COPY, normaliseSettings, safeEmail, safeExternalUrl } from "./settings-input";

describe("safeExternalUrl", () => {
  it("accepts http and https", () => {
    expect(safeExternalUrl("https://www.instagram.com/her")).toBe("https://www.instagram.com/her");
    expect(safeExternalUrl("http://example.com/")).toBe("http://example.com/");
    expect(safeExternalUrl("  https://etsy.com/shop/her  ")).toBe("https://etsy.com/shop/her");
  });

  it("rejects every scheme that could execute", () => {
    // These render straight into an href in the header and footer.
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects a bare host rather than guessing a scheme", () => {
    expect(safeExternalUrl("instagram.com/her")).toBeNull();
    expect(safeExternalUrl("//evil.com")).toBeNull();
  });

  it("rejects an empty value", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
  });
});

describe("safeEmail", () => {
  it("accepts an ordinary address", () => {
    expect(safeEmail("hello@example.com")).toBe("hello@example.com");
    expect(safeEmail("  her.name+prints@studio.co.uk  ")).toBe("her.name+prints@studio.co.uk");
  });

  it("rejects anything that would break out of a mailto href", () => {
    expect(safeEmail('a"@b.com')).toBeNull();
    expect(safeEmail("a b@c.com")).toBeNull();
    expect(safeEmail("a@b.com'><script>")).toBeNull();
  });

  it("rejects a malformed address", () => {
    expect(safeEmail("hello")).toBeNull();
    expect(safeEmail("hello@")).toBeNull();
    expect(safeEmail("hello@example")).toBeNull();
    expect(safeEmail("a@@b.com")).toBeNull();
    expect(safeEmail("")).toBeNull();
  });
});

describe("normaliseSettings", () => {
  it("reports a bad link instead of dropping it silently", () => {
    const { values, rejected } = normaliseSettings({ instagramUrl: "javascript:alert(1)" });
    expect(values.instagramUrl).toBeUndefined();
    expect(rejected).toEqual(["Instagram address"]);
  });

  it("treats an emptied field as clearing it, not as an error", () => {
    // An artist with no Instagram has to be able to say so.
    const { values, rejected } = normaliseSettings({ instagramUrl: "  ", contactEmail: "" });
    expect(values.instagramUrl).toBe("");
    expect(values.contactEmail).toBe("");
    expect(rejected).toEqual([]);
  });

  it("only touches the fields it is given", () => {
    const { values } = normaliseSettings({ siteName: "Her Name" });
    expect(values).toEqual({ siteName: "Her Name" });
  });

  it("normalises the highlight colour and rejects a non-colour", () => {
    expect(normaliseSettings({ accentColour: "#ABC" }).values.accentColour).toBe("#aabbcc");

    const bad = normaliseSettings({ accentColour: "#abc; } body { display: none }" });
    expect(bad.values.accentColour).toBeUndefined();
    expect(bad.rejected).toEqual(["Highlight colour"]);
  });

  it("truncates copy past the cap", () => {
    const long = "x".repeat(MAX_COPY + 500);
    expect(normaliseSettings({ aboutCopy: long }).values.aboutCopy).toHaveLength(MAX_COPY);
  });

  it("keeps the paragraph structure of copy while trimming its ends", () => {
    const { values } = normaliseSettings({ aboutCopy: "\n\nFirst.\n\nSecond.\n\n" });
    expect(values.aboutCopy).toBe("First.\n\nSecond.");
  });

  it("collects several rejections at once", () => {
    const { rejected } = normaliseSettings({
      instagramUrl: "nope",
      etsyShopUrl: "also nope",
      contactEmail: "not an email",
    });
    expect(rejected).toEqual(["Instagram address", "Etsy shop address", "Contact email"]);
  });
});
