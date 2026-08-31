import { describe, expect, it } from "vitest";
import {
  canvasHeightRatio,
  coverImage,
  headingTextId,
  inReadingOrder,
  isInteractive,
  showsHoverName,
  type PortfolioItem,
  type WallText,
} from "./portfolio";

const item = (over: Partial<PortfolioItem>): PortfolioItem => ({
  id: "a",
  slug: "a",
  name: "A",
  information: "",
  status: "published",
  x: 0,
  y: 0,
  width: 30,
  z: 0,
  parentId: null,
  clickable: true,
  images: [],
  ...over,
});

const withCover = (w: number, h: number) => [
  { id: "i", src: "/media/a.jpg", alt: "", width: w, height: h },
];

describe("coverImage", () => {
  it("is the first image, which is the one shown on the wall", () => {
    const i = item({
      images: [
        { id: "1", src: "/a", alt: "", width: 10, height: 10 },
        { id: "2", src: "/b", alt: "", width: 10, height: 10 },
      ],
    });
    expect(coverImage(i)?.id).toBe("1");
  });

  it("is undefined before any photograph is uploaded", () => {
    expect(coverImage(item({}))).toBeUndefined();
  });
});

describe("inReadingOrder", () => {
  // The mobile stack is derived from the arrangement rather than stored, so
  // the artist never maintains a second ordering that can drift.
  it("goes top to bottom, then left to right", () => {
    const items = [
      item({ id: "bottom-left", x: 5, y: 50 }),
      item({ id: "top-right", x: 60, y: 2 }),
      item({ id: "top-left", x: 4, y: 2 }),
    ];
    expect(inReadingOrder(items).map((i) => i.id)).toEqual([
      "top-left",
      "top-right",
      "bottom-left",
    ]);
  });

  it("does not mutate the array it is given", () => {
    const items = [item({ id: "b", y: 9 }), item({ id: "a", y: 1 })];
    inReadingOrder(items);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("canvasHeightRatio", () => {
  it("is tall enough to contain the lowest piece", () => {
    // A square image 40 wide sitting at y=50 reaches 90.
    const items = [item({ y: 50, width: 40, images: withCover(100, 100) })];
    expect(canvasHeightRatio(items)).toBeGreaterThanOrEqual(90);
  });

  it("accounts for aspect ratio, not just width", () => {
    // Placed low and wide enough that both clear the minimum height, so this
    // measures aspect ratio rather than the floor.
    const wide = canvasHeightRatio([item({ y: 60, width: 60, images: withCover(200, 100) })]);
    const tall = canvasHeightRatio([item({ y: 60, width: 60, images: withCover(100, 200) })]);
    expect(tall).toBeGreaterThan(wide);
  });

  it("leaves headroom below the lowest piece to drag into", () => {
    const bottom = 60 + 60; // y + width * aspect, for a square cover
    expect(
      canvasHeightRatio([item({ y: 60, width: 60, images: withCover(100, 100) })]),
    ).toBeGreaterThan(bottom);
  });

  it("keeps a floor so an empty or shallow wall still has height", () => {
    expect(canvasHeightRatio([])).toBeGreaterThan(0);
  });
});

const text = (over: Partial<WallText>): WallText => ({
  id: "t",
  content: "words",
  x: 0,
  y: 0,
  width: 30,
  height: 10,
  z: 0,
  fontSize: 2,
  align: "left",
  bold: false,
  italic: false,
  underline: false,
  colour: "#101010",
  font: "sans",
  parentId: null,
  ...over,
});

describe("headingTextId", () => {
  // Replacing the fixed heading with free text boxes must not leave the page
  // with no <h1>.
  it("picks the largest text as the page heading", () => {
    const id = headingTextId([
      text({ id: "small", fontSize: 1.6 }),
      text({ id: "big", fontSize: 5.2 }),
    ]);
    expect(id).toBe("big");
  });

  it("breaks a tie by whichever sits highest", () => {
    const id = headingTextId([
      text({ id: "lower", fontSize: 3, y: 40 }),
      text({ id: "upper", fontSize: 3, y: 4 }),
    ]);
    expect(id).toBe("upper");
  });

  it("ignores empty boxes so a blank one cannot become the heading", () => {
    const id = headingTextId([
      text({ id: "blank", fontSize: 9, content: "   " }),
      text({ id: "real", fontSize: 2 }),
    ]);
    expect(id).toBe("real");
  });

  it("returns null when there is no text at all", () => {
    expect(headingTextId([])).toBeNull();
  });
});

describe("isInteractive", () => {
  it("is true for a clickable top-level piece", () => {
    expect(isInteractive(item({ clickable: true, parentId: null }))).toBe(true);
  });

  it("is false once clickable is turned off, which hides its page", () => {
    expect(isInteractive(item({ clickable: false }))).toBe(false);
  });

  // Elements on a piece's page compose that page; they are not links onward.
  it("is false for an element on a piece's own page, even if marked clickable", () => {
    expect(isInteractive(item({ clickable: true, parentId: "parent" }))).toBe(false);
  });
});

describe("showsHoverName", () => {
  /**
   * The rule that lets decorative marks and icons sit on the wall without
   * advertising themselves as clickable.
   */
  it("shows nothing on hover when the piece has no title", () => {
    expect(showsHoverName(item({ name: "" }), true)).toBe(false);
    expect(showsHoverName(item({ name: "   " }), true)).toBe(false);
  });

  it("shows the name for a titled, clickable piece", () => {
    expect(showsHoverName(item({ name: "Harbour Wall" }), true)).toBe(true);
  });

  it("respects the page-wide setting", () => {
    expect(showsHoverName(item({ name: "Harbour Wall" }), false)).toBe(false);
  });

  it("shows nothing for a piece that is not clickable", () => {
    expect(showsHoverName(item({ name: "Harbour Wall", clickable: false }), true)).toBe(false);
  });

  it("shows nothing for an element on a piece's own page", () => {
    expect(showsHoverName(item({ name: "Detail", parentId: "parent" }), true)).toBe(false);
  });
});
