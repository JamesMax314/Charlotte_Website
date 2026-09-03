import { describe, expect, it } from "vitest";
import {
  backupMediaKeys,
  coerceRows,
  isEmptyBackup,
  mergeBackups,
  parentsFirst,
  RESTORE_ORDER,
  type Backup,
} from "./undo-backup";

/** A complete, valid `portfolio_images` row — the smallest table with a key. */
const imageRow = (overrides: Record<string, unknown> = {}) => ({
  id: "img-1",
  itemId: "piece-1",
  storageKey: "media/abc.jpg",
  alt: "A pen drawing",
  width: 1200,
  height: 900,
  lqip: null,
  sortOrder: 0,
  ...overrides,
});

describe("RESTORE_ORDER", () => {
  /*
    Not cosmetic. `db.batch` runs in a transaction and SQLite checks a foreign
    key as each row lands, so a child inserted before its parent fails the
    whole restore.
  */
  it("puts every table before the tables that reference it", () => {
    const at = (table: string) => RESTORE_ORDER.indexOf(table as never);

    expect(at("site_pages")).toBeLessThan(at("portfolio_items"));
    expect(at("site_pages")).toBeLessThan(at("wall_texts"));
    expect(at("portfolio_items")).toBeLessThan(at("portfolio_images"));
    expect(at("portfolio_items")).toBeLessThan(at("wall_texts"));
    expect(at("artworks")).toBeLessThan(at("artwork_images"));
    expect(at("artworks")).toBeLessThan(at("listings"));
  });
});

describe("coerceRows", () => {
  it("keeps every declared column", () => {
    expect(coerceRows("portfolio_images", [imageRow()])).toEqual([imageRow()]);
  });

  /*
    A backup taken before a column was removed is what an unknown key looks
    like, and that is a history from earlier in this same session rather than
    anything hostile.
  */
  it("drops keys the schema does not declare", () => {
    const [row] = coerceRows("portfolio_images", [imageRow({ mischief: "<script>" })]);
    expect(row).not.toHaveProperty("mischief");
  });

  it("keeps null in a nullable column", () => {
    const [row] = coerceRows("portfolio_images", [imageRow({ lqip: null })]);
    expect(row.lqip).toBeNull();
  });

  /*
    Refused rather than dropped: a dropped notNull column takes the schema
    default instead, so a piece could come back published when it was a draft
    with nothing anywhere reporting it.
  */
  it("refuses a required column the backup has no value for", () => {
    expect(() => coerceRows("portfolio_images", [imageRow({ alt: undefined })])).toThrow(/alt/);
    expect(() => coerceRows("portfolio_images", [imageRow({ itemId: null })])).toThrow(/itemId/);
  });

  it("refuses a value of the wrong type", () => {
    expect(() => coerceRows("portfolio_images", [imageRow({ width: "1200" })])).toThrow(/number/);
    expect(() => coerceRows("portfolio_images", [imageRow({ alt: 7 })])).toThrow(/string/);
    expect(() => coerceRows("portfolio_images", [imageRow({ width: Number.NaN })])).toThrow(
      /number/,
    );
  });

  it("refuses an enum value that is not in the schema's list", () => {
    const base = {
      id: "page-1",
      slug: "studio",
      title: "Studio",
      status: "published",
      navOrder: 0,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(coerceRows("site_pages", [base])[0].status).toBe("published");
    expect(() => coerceRows("site_pages", [{ ...base, status: "live" }])).toThrow(/not allowed/);
  });

  it("accepts a timestamp as a Date or as epoch milliseconds", () => {
    const base = {
      id: "page-1",
      slug: "studio",
      title: "Studio",
      status: "draft",
      navOrder: 0,
      createdAt: 1_700_000_000_000,
      updatedAt: new Date(1_700_000_000_000),
    };
    const [row] = coerceRows("site_pages", [base]);
    expect(row.createdAt).toEqual(new Date(1_700_000_000_000));
    expect(row.updatedAt).toEqual(new Date(1_700_000_000_000));
  });

  it("refuses a timestamp that does not parse", () => {
    const base = {
      id: "page-1",
      slug: "studio",
      title: "Studio",
      status: "draft",
      navOrder: 0,
      createdAt: "not a date",
      updatedAt: 0,
    };
    expect(() => coerceRows("site_pages", [base])).toThrow(/date/);
  });
});

describe("parentsFirst", () => {
  // portfolio_items references itself, which is the one ordering RESTORE_ORDER
  // cannot express.
  it("puts rows with no parent ahead of their children", () => {
    const ordered = parentsFirst([
      { id: "child", parentId: "parent" },
      { id: "parent", parentId: null },
      { id: "loose" },
    ]);
    expect(ordered.map((row) => row.id)).toEqual(["parent", "loose", "child"]);
  });
});

describe("backupMediaKeys", () => {
  it("collects storage keys across tables and de-duplicates them", () => {
    const backup: Backup = {
      portfolio_images: [imageRow(), imageRow({ id: "img-2" })],
      site_fonts: [{ id: "font-1", storageKey: "fonts/x.woff2" }],
    };
    expect(backupMediaKeys(backup)).toEqual(["media/abc.jpg", "fonts/x.woff2"]);
  });

  it("ignores rows and tables that carry no key", () => {
    expect(backupMediaKeys({ wall_texts: [{ id: "t1" }] })).toEqual([]);
    expect(backupMediaKeys({})).toEqual([]);
  });
});

describe("mergeBackups", () => {
  it("concatenates per table", () => {
    const merged = mergeBackups(
      { portfolio_items: [{ id: "a" }] },
      { portfolio_items: [{ id: "b" }], wall_texts: [{ id: "t" }] },
    );
    expect(merged.portfolio_items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(merged.wall_texts).toEqual([{ id: "t" }]);
  });
});

describe("isEmptyBackup", () => {
  it("treats absent and empty tables alike", () => {
    expect(isEmptyBackup({})).toBe(true);
    expect(isEmptyBackup({ wall_texts: [] })).toBe(true);
    expect(isEmptyBackup({ wall_texts: [{ id: "t" }] })).toBe(false);
  });
});
