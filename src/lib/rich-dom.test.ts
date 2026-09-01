import { describe, expect, it } from "vitest";
import { BUILT_IN_FONTS } from "./fonts";
import { applyDocToElement, docFromElement } from "./rich-dom";
import { docToPlain, type RichDoc } from "./rich-text";

const editable = (html: string): HTMLElement => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};

describe("docFromElement", () => {
  it("reads plain typing as one paragraph", () => {
    expect(docFromElement(editable("<div>Hello there</div>"))).toEqual([[{ text: "Hello there" }]]);
  });

  it("reads a block per paragraph", () => {
    expect(docFromElement(editable("<div>One</div><div>Two</div>"))).toEqual([
      [{ text: "One" }],
      [{ text: "Two" }],
    ]);
  });

  // A fresh editor holds a bare text node with no block around it.
  it("reads loose text at the root as a single paragraph", () => {
    expect(docFromElement(editable("just typing"))).toEqual([[{ text: "just typing" }]]);
  });

  it("reads the marks the toolbar writes", () => {
    const doc = docFromElement(
      editable("<div><strong>bold</strong><em>it</em><u>un</u>plain</div>"),
    );
    expect(doc).toEqual([
      [
        { text: "bold", bold: true },
        { text: "it", italic: true },
        { text: "un", underline: true },
        { text: "plain" },
      ],
    ]);
  });

  // execCommand emits <b>/<i> rather than <strong>/<em> in some browsers.
  it("reads the tags execCommand emits as the same marks", () => {
    expect(docFromElement(editable("<div><b>a</b><i>b</i></div>"))).toEqual([
      [
        { text: "a", bold: true },
        { text: "b", italic: true },
      ],
    ]);
  });

  it("reads nested marks as one run carrying both", () => {
    expect(docFromElement(editable("<div><strong><em>both</em></strong></div>"))).toEqual([
      [{ text: "both", bold: true, italic: true }],
    ]);
  });

  it("reads colour, font and size back from their data attributes", () => {
    const id = BUILT_IN_FONTS[0].id;
    const doc = docFromElement(
      editable(
        `<div><span data-rt-colour="#aabbcc" data-rt-font="${id}" data-rt-size="1.5">x</span></div>`,
      ),
      BUILT_IN_FONTS,
    );
    expect(doc).toEqual([[{ text: "x", colour: "#aabbcc", font: id, size: 1.5 }]]);
  });

  it("reads a link", () => {
    expect(docFromElement(editable('<div><a href="https://example.com">go</a></div>'))).toEqual([
      [{ text: "go", href: "https://example.com/" }],
    ]);
  });

  /**
   * The claim this module exists to make. A paste can carry anything; the
   * walker reads only what it recognises, so markup does not need escaping
   * because it is never read in the first place.
   */
  it("takes the text out of a hostile paste and nothing else", () => {
    const doc = docFromElement(
      editable(
        '<div>before<script>alert(1)</script><img src=x onerror="alert(1)">' +
          '<a href="javascript:alert(1)" onclick="alert(1)">click</a>' +
          '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>after</div>',
      ),
    );
    const serialised = JSON.stringify(doc);
    expect(serialised).not.toMatch(/script|onerror|onclick|javascript:/i);
    expect(docToPlain(doc)).toBe("beforeclickafter");
  });

  it("drops a pasted stylesheet rather than treating its rules as text", () => {
    const doc = docFromElement(editable("<div><style>p{color:red}</style>words</div>"));
    expect(docToPlain(doc)).toBe("words");
  });

  it("keeps a pasted link's text but drops an unusable scheme", () => {
    const doc = docFromElement(editable('<div><a href="javascript:alert(1)">text</a></div>'));
    expect(doc).toEqual([[{ text: "text" }]]);
  });

  it("turns a shift+Enter line break into a paragraph", () => {
    expect(docFromElement(editable("<div>one<br>two</div>"))).toEqual([
      [{ text: "one" }],
      [{ text: "two" }],
    ]);
  });

  it("reads an empty editor as an empty document", () => {
    expect(docFromElement(editable("<div><br></div>"))).toEqual([]);
    expect(docFromElement(editable(""))).toEqual([]);
  });

  // Typing inside a mark yields a text node per keystroke in some browsers.
  it("merges the run-per-text-node the browser produces", () => {
    const el = editable("<div><strong></strong></div>");
    const strong = el.querySelector("strong")!;
    for (const ch of "hello") strong.appendChild(document.createTextNode(ch));
    expect(docFromElement(el)).toEqual([[{ text: "hello", bold: true }]]);
  });
});

describe("applyDocToElement", () => {
  const roundTrip = (doc: RichDoc): RichDoc => {
    const el = document.createElement("div");
    applyDocToElement(el, doc, BUILT_IN_FONTS);
    return docFromElement(el, BUILT_IN_FONTS);
  };

  it("round-trips a document through the DOM unchanged", () => {
    const doc: RichDoc = [
      [
        { text: "A ", bold: true },
        { text: "link", href: "https://example.com/" },
        { text: " and ", italic: true, colour: "#123456" },
        { text: "big", size: 2, font: BUILT_IN_FONTS[0].id },
      ],
      [],
      [{ text: "Second paragraph", underline: true }],
    ];
    expect(roundTrip(doc)).toEqual(doc);
  });

  it("round-trips an empty document", () => {
    expect(roundTrip([])).toEqual([]);
  });

  /**
   * A blank block needs a <br> or it collapses and cannot hold a caret — the
   * artist would find she could not click into her own empty line.
   */
  it("gives a blank paragraph something to hold a caret", () => {
    const el = document.createElement("div");
    applyDocToElement(el, [[{ text: "a" }], [], [{ text: "b" }]], BUILT_IN_FONTS);
    expect(el.children[1].innerHTML).toBe("<br>");
  });
});
