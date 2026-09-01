import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_VERSION,
  canonicalise,
  hashSnapshot,
  parseSnapshot,
  serialiseSnapshot,
  snapshotMediaKeys,
  timeless,
  type SiteSnapshot,
} from "./site-snapshot";

const empty: SiteSnapshot = {
  version: SNAPSHOT_VERSION,
  settings: null,
  fonts: [],
  pages: [],
  items: [],
  itemImages: [],
  texts: [],
  artworks: [],
  artworkImages: [],
  listings: [],
};

const snapshot = (over: Partial<SiteSnapshot>): SiteSnapshot => ({ ...empty, ...over });

describe("canonicalise", () => {
  it("sorts keys at every depth", () => {
    const a = { b: 1, a: { d: 2, c: [{ f: 3, e: 4 }] } };
    const b = { a: { c: [{ e: 4, f: 3 }], d: 2 }, b: 1 };
    expect(JSON.stringify(canonicalise(a))).toBe(JSON.stringify(canonicalise(b)));
  });

  it("leaves array order alone", () => {
    expect(JSON.stringify(canonicalise([1, 2]))).not.toBe(JSON.stringify(canonicalise([2, 1])));
  });

  it("passes nulls through rather than treating them as objects", () => {
    expect(canonicalise({ a: null })).toEqual({ a: null });
  });
});

describe("hashSnapshot", () => {
  it("is the same for the same content", async () => {
    expect(await hashSnapshot(empty)).toBe(await hashSnapshot(snapshot({})));
  });

  /*
    The whole point of canonicalising. Without it the digest tracks the order a
    query returned its columns in, and reordering a `select` or a schema column
    tells the artist her site has unpublished changes when nothing changed.
  */
  it("ignores the order the keys arrive in", async () => {
    const backwards = Object.fromEntries(
      Object.entries(empty).reverse(),
    ) as unknown as SiteSnapshot;
    expect(await hashSnapshot(empty)).toBe(await hashSnapshot(backwards));
  });

  it("changes when content changes", async () => {
    const one = snapshot({
      pages: [{ id: "p", slug: "s", title: "S", status: "published", navOrder: 0 }],
    });
    const two = snapshot({
      pages: [{ id: "p", slug: "s", title: "T", status: "published", navOrder: 0 }],
    });
    expect(await hashSnapshot(one)).not.toBe(await hashSnapshot(two));
  });

  /*
    Row order is part of what a visitor sees — it is the layer order of the
    wall — so two arrangements of the same pieces are two different sites.
  */
  it("changes when the order changes", async () => {
    const rows = [
      { id: "a", slug: "a", title: "A", status: "published" as const, navOrder: 0 },
      { id: "b", slug: "b", title: "B", status: "published" as const, navOrder: 1 },
    ];
    expect(await hashSnapshot(snapshot({ pages: rows }))).not.toBe(
      await hashSnapshot(snapshot({ pages: [...rows].reverse() })),
    );
  });
});

describe("timeless", () => {
  it("drops the timestamps and keeps everything else", () => {
    const row = { id: "a", name: "n", createdAt: new Date(1), updatedAt: new Date(2) };
    expect(timeless([row])).toEqual([{ id: "a", name: "n" }]);
  });

  it("does not mutate the row it was given", () => {
    const row = { id: "a", createdAt: new Date(1), updatedAt: new Date(2) };
    timeless([row]);
    expect(row.createdAt).toBeInstanceOf(Date);
  });
});

describe("parseSnapshot", () => {
  it("round-trips a snapshot", () => {
    const pages = [{ id: "p", slug: "s", title: "S", status: "published" as const, navOrder: 0 }];
    expect(parseSnapshot(serialiseSnapshot(snapshot({ pages })))?.pages).toEqual(pages);
  });

  /*
    Null rather than a throw, everywhere: an unreadable revision has to fall
    through to the draft tables — the site the artist last saved — rather than
    take every public page down with it.
  */
  it("refuses a version it does not know", () => {
    expect(parseSnapshot(JSON.stringify({ ...empty, version: SNAPSHOT_VERSION + 1 }))).toBeNull();
  });

  it("refuses malformed JSON", () => {
    expect(parseSnapshot("{ not json")).toBeNull();
  });

  it("refuses a snapshot missing one of its lists", () => {
    const missing: Record<string, unknown> = { ...empty };
    delete missing.items;
    expect(parseSnapshot(JSON.stringify(missing))).toBeNull();
  });

  it("refuses a bare value", () => {
    expect(parseSnapshot("42")).toBeNull();
  });
});

describe("snapshotMediaKeys", () => {
  it("collects every key the live site depends on, once each", () => {
    const keys = snapshotMediaKeys(
      snapshot({
        itemImages: [{ storageKey: "portfolio/a.jpg" }, { storageKey: "portfolio/a.jpg" }],
        artworkImages: [{ storageKey: "shop/b.jpg" }],
        fonts: [{ storageKey: "fonts/c.woff2" }],
        settings: { faviconKey: "assets/d.png", aboutPhotoKey: "assets/e.jpg" },
      } as unknown as Partial<SiteSnapshot>),
    );
    expect([...keys].sort()).toEqual([
      "assets/d.png",
      "assets/e.jpg",
      "fonts/c.woff2",
      "portfolio/a.jpg",
      "shop/b.jpg",
    ]);
  });

  it("copes with a settings row that has no mark or photograph", () => {
    const keys = snapshotMediaKeys(
      snapshot({
        settings: { faviconKey: null, aboutPhotoKey: null },
      } as unknown as Partial<SiteSnapshot>),
    );
    expect(keys.size).toBe(0);
  });
});
