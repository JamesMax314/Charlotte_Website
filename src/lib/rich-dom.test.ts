import { describe, expect, it } from "vitest";
import { BUILT_IN_FONTS } from "./fonts";
import {
  activeAlign,
  alignOfBlock,
  activeSpanMark,
  applyDocToElement,
  applySpanMark,
  clearMarks,
  clearMarksInRange,
  docFromElement,
  markSpan,
  rebaseSizeStyle,
} from "./rich-dom";
import { docToPlain, type RichDoc } from "./rich-text";

const editable = (html: string): HTMLElement => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};

describe("docFromElement", () => {
  it("reads plain typing as one paragraph", () => {
    expect(docFromElement(editable("<div>Hello there</div>"))).toEqual([
      { runs: [{ text: "Hello there" }] },
    ]);
  });

  it("reads a block per paragraph", () => {
    expect(docFromElement(editable("<div>One</div><div>Two</div>"))).toEqual([
      { runs: [{ text: "One" }] },
      { runs: [{ text: "Two" }] },
    ]);
  });

  // A fresh editor holds a bare text node with no block around it.
  it("reads the alignment written on a block", () => {
    expect(docFromElement(editable('<div style="text-align: center">Mid</div>'))).toEqual([
      { runs: [{ text: "Mid" }], align: "center" },
    ]);
  });

  /**
   * execCommand emits the attribute form when styleWithCSS is off, which is
   * how this editor leaves it — see the note on ALIGNMENTS in the editor.
   */
  it("reads the attribute form execCommand can emit instead", () => {
    expect(docFromElement(editable('<div align="right">End</div>'))).toEqual([
      { runs: [{ text: "End" }], align: "right" },
    ]);
  });

  /**
   * The root's text-align is the box's own setting, inherited rather than
   * chosen. Reading it would stamp the box's default onto every paragraph,
   * turning "follow the box" into a copy that then stops following it.
   */
  it("never takes an alignment from the editor root", () => {
    const el = editable("<div>Words</div>");
    el.style.textAlign = "center";
    expect(docFromElement(el)).toEqual([{ runs: [{ text: "Words" }] }]);
  });

  it("gives a shift+Enter line the alignment of the block it sits in", () => {
    expect(docFromElement(editable('<div style="text-align: right">one<br>two</div>'))).toEqual([
      { runs: [{ text: "one" }], align: "right" },
      { runs: [{ text: "two" }], align: "right" },
    ]);
  });

  it("reads loose text at the root as a single paragraph", () => {
    expect(docFromElement(editable("just typing"))).toEqual([{ runs: [{ text: "just typing" }] }]);
  });

  it("reads the marks the toolbar writes", () => {
    const doc = docFromElement(
      editable("<div><strong>bold</strong><em>it</em><u>un</u>plain</div>"),
    );
    expect(doc).toEqual([
      {
        runs: [
          { text: "bold", bold: true },
          { text: "it", italic: true },
          { text: "un", underline: true },
          { text: "plain" },
        ],
      },
    ]);
  });

  // execCommand emits <b>/<i> rather than <strong>/<em> in some browsers.
  it("reads the tags execCommand emits as the same marks", () => {
    expect(docFromElement(editable("<div><b>a</b><i>b</i></div>"))).toEqual([
      {
        runs: [
          { text: "a", bold: true },
          { text: "b", italic: true },
        ],
      },
    ]);
  });

  it("reads nested marks as one run carrying both", () => {
    expect(docFromElement(editable("<div><strong><em>both</em></strong></div>"))).toEqual([
      { runs: [{ text: "both", bold: true, italic: true }] },
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
    expect(doc).toEqual([{ runs: [{ text: "x", colour: "#aabbcc", font: id, size: 1.5 }] }]);
  });

  it("reads a link", () => {
    expect(docFromElement(editable('<div><a href="https://example.com">go</a></div>'))).toEqual([
      { runs: [{ text: "go", href: "https://example.com/" }] },
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
    expect(doc).toEqual([{ runs: [{ text: "text" }] }]);
  });

  it("turns a shift+Enter line break into a paragraph", () => {
    expect(docFromElement(editable("<div>one<br>two</div>"))).toEqual([
      { runs: [{ text: "one" }] },
      { runs: [{ text: "two" }] },
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
    expect(docFromElement(el)).toEqual([{ runs: [{ text: "hello", bold: true }] }]);
  });
});

describe("markSpan", () => {
  /**
   * The regression this function exists to prevent. The toolbar used to build
   * its own span and set the face's data attribute without its style, so a
   * chosen typeface saved correctly, rendered correctly on the site, and
   * showed no change whatsoever in the editor until the box was reloaded.
   *
   * Every mark must write both halves: the style is what the artist sees, the
   * attribute is what is read back.
   */
  it("writes both a style and a data attribute for every mark", () => {
    const id = BUILT_IN_FONTS[0].id;
    for (const [mark, styleProp] of [
      [{ colour: "#aabbcc" }, "color"],
      [{ font: id }, "fontFamily"],
      [{ size: 1.5 }, "fontSize"],
    ] as const) {
      const span = markSpan(mark, BUILT_IN_FONTS);
      expect(span.style[styleProp], `${styleProp} is not set`).not.toBe("");
      expect(span.attributes.length, "no data attribute written").toBeGreaterThan(0);
    }
  });

  it("round-trips through the reader it is paired with", () => {
    const id = BUILT_IN_FONTS[0].id;
    const block = document.createElement("div");
    const span = markSpan({ colour: "#aabbcc", font: id, size: 1.5 }, BUILT_IN_FONTS);
    span.textContent = "x";
    block.appendChild(span);
    const root = document.createElement("div");
    root.appendChild(block);
    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "x", colour: "#aabbcc", font: id, size: 1.5 }] },
    ]);
  });
});

describe("alignOfBlock", () => {
  it("ignores an alignment the artist cannot choose", () => {
    const el = editable('<div style="text-align: justify">x</div>');
    expect(alignOfBlock(el.firstElementChild as HTMLElement)).toBeUndefined();
  });

  it("reports nothing for a block that was never aligned", () => {
    expect(alignOfBlock(editable("<div>x</div>").firstElementChild as HTMLElement)).toBeUndefined();
  });
});

describe("activeAlign", () => {
  it("finds the alignment of the block the caret is in", () => {
    const root = editable('<div style="text-align: center">x</div>');
    expect(activeAlign(root.querySelector("div")!.firstChild, root)).toBe("center");
  });

  /** Undefined, not "left": she has expressed no opinion and the box decides. */
  it("reports nothing where no alignment has been chosen", () => {
    const root = editable("<div>x</div>");
    expect(activeAlign(root.querySelector("div")!.firstChild, root)).toBeUndefined();
  });

  it("stops at the editor root, whose alignment belongs to the box", () => {
    const root = editable("<div>x</div>");
    root.style.textAlign = "right";
    expect(activeAlign(root.querySelector("div")!.firstChild, root)).toBeUndefined();
  });
});

describe("activeSpanMark", () => {
  const inEditor = (html: string) => {
    const root = document.createElement("div");
    root.innerHTML = html;
    return root;
  };

  it("reports nothing where the text carries no marks of its own", () => {
    const root = inEditor("<div>plain</div>");
    expect(activeSpanMark(root.querySelector("div")!.firstChild, root)).toEqual({});
  });

  it("reports the face and size the caret is standing in", () => {
    const id = BUILT_IN_FONTS[0].id;
    const root = inEditor(
      `<div><span data-rt-font="${id}" data-rt-size="2"><span data-rt-colour="#aabbcc">x</span></span></div>`,
    );
    const caret = root.querySelector("[data-rt-colour]")!.firstChild;
    expect(activeSpanMark(caret, root)).toEqual({ font: id, size: 2, colour: "#aabbcc" });
  });

  /** The nearest mark wins, which is what nesting a run inside another means. */
  it("takes the innermost of two marks of the same kind", () => {
    const root = inEditor(
      '<div><span data-rt-size="3"><span data-rt-size="1.4">x</span></span></div>',
    );
    expect(activeSpanMark(root.querySelector("[data-rt-size='1.4']")!.firstChild, root).size).toBe(
      1.4,
    );
  });

  it("stops at the editor root rather than walking out of it", () => {
    const outer = document.createElement("div");
    outer.setAttribute("data-rt-size", "5");
    const root = document.createElement("div");
    root.innerHTML = "<div>x</div>";
    outer.appendChild(root);
    expect(activeSpanMark(root.querySelector("div")!.firstChild, root)).toEqual({});
  });

  it("copes with no caret at all", () => {
    expect(activeSpanMark(null, document.createElement("div"))).toEqual({});
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
      {
        runs: [
          { text: "A ", bold: true },
          { text: "link", href: "https://example.com/" },
          { text: " and ", italic: true, colour: "#123456" },
          { text: "big", size: 2, font: BUILT_IN_FONTS[0].id },
        ],
      },
      { runs: [] },
      { runs: [{ text: "Second paragraph", underline: true }], align: "center" },
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
    applyDocToElement(
      el,
      [{ runs: [{ text: "a" }] }, { runs: [] }, { runs: [{ text: "b" }] }],
      BUILT_IN_FONTS,
    );
    expect(el.children[1].innerHTML).toBe("<br>");
  });
});

/*
  The model flattens and the DOM does not, and these two functions are what
  reconciles them.

  A run's size is a multiple of the *box*. `marksOf` reads only the innermost
  mark, so nesting cannot change what is stored — but the style is `em`, which
  multiplies. Applying 30pt inside a half-size run therefore painted half of
  30 while storing the full multiple, so the editor and the saved document
  disagreed and every further adjustment drifted from the last.
*/
describe("marks are replaced, not nested", () => {
  const rooted = (html: string): HTMLElement => {
    const root = document.createElement("div");
    root.innerHTML = html;
    return root;
  };

  it("drops the size marks inside a span, style and attribute together", () => {
    const root = rooted(
      '<div><span data-rt-size="2" style="font-size: 2em">' +
        '<span data-rt-size="0.5" style="font-size: 0.5em">x</span>' +
        "</span></div>",
    );
    const outer = root.querySelector<HTMLElement>("[data-rt-size]")!;
    clearMarks(outer, ["size"]);

    expect(root.querySelectorAll("[data-rt-size]")).toHaveLength(1);
    expect(outer.getAttribute("data-rt-size")).toBe("2");
    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([{ runs: [{ text: "x", size: 2 }] }]);
  });

  /** Only the kind being applied is replaced; the others are hers to keep. */
  it("leaves marks of other kinds alone", () => {
    const root = rooted(
      '<div><span data-rt-size="2"><span data-rt-colour="#aabbcc">x</span></span></div>',
    );
    clearMarks(root.querySelector<HTMLElement>("[data-rt-size]")!, ["size"]);
    expect(root.querySelector("[data-rt-colour]")).not.toBeNull();
  });

  it("drops a nested colour, style and attribute together", () => {
    const root = rooted(
      '<div><span data-rt-colour="#101010" style="color: #101010">' +
        '<span data-rt-colour="#2140d6" style="color: #2140d6">x</span>' +
        "</span></div>",
    );
    const outer = root.querySelector<HTMLElement>("[data-rt-colour]")!;
    clearMarks(outer, ["colour"]);

    expect(root.querySelectorAll("[data-rt-colour]")).toHaveLength(1);
    expect(root.querySelector<HTMLElement>("span span")!.style.color).toBe("");
    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "x", colour: "#101010" }] },
    ]);
  });

  /*
    What "Clear" leaves behind if nobody strips the attributes: removeFormat
    empties the style and the mark reads back off data-rt-colour regardless, so
    the box looks plain and publishes coloured.
  */
  it("strips every mark a selection touches, and none that it does not", () => {
    const root = rooted(
      '<div><span data-rt-colour="#2140d6" data-rt-size="2">cleared</span></div>' +
        '<div><span data-rt-colour="#2140d6">kept</span></div>',
    );
    const range = document.createRange();
    range.selectNodeContents(root.firstElementChild!);

    clearMarksInRange(root, range);

    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "cleared" }] },
      { runs: [{ text: "kept", colour: "#2140d6" }] },
    ]);
  });

  it("divides the style by what the span nests inside, keeping the attribute true", () => {
    const root = rooted('<div><span data-rt-size="0.5" style="font-size: 0.5em"></span></div>');
    const parent = root.querySelector<HTMLElement>("[data-rt-size]")!;
    const span = markSpan({ size: 1.5 }, BUILT_IN_FONTS);
    span.textContent = "x";
    parent.appendChild(span);

    rebaseSizeStyle(span, 1.5, root);

    // 1.5 of the box, sitting inside half of it, is three times its parent.
    expect(span.style.fontSize).toBe("3em");
    expect(span.getAttribute("data-rt-size")).toBe("1.5");
  });

  it("leaves the style alone when the span is a direct child of the box", () => {
    const root = rooted("<div></div>");
    const span = markSpan({ size: 1.5 }, BUILT_IN_FONTS);
    span.textContent = "x";
    root.firstElementChild!.appendChild(span);

    rebaseSizeStyle(span, 1.5, root);
    expect(span.style.fontSize).toBe("1.5em");
  });

  it("does nothing when no size is being applied", () => {
    const root = rooted("<div></div>");
    const span = markSpan({ colour: "#aabbcc" }, BUILT_IN_FONTS);
    root.firstElementChild!.appendChild(span);
    rebaseSizeStyle(span, undefined, root);
    expect(span.style.fontSize).toBe("");
  });
});

/*
  The whole path, driven through a live selection rather than through its
  parts, because every previous failure here was in the wiring.

  The size the panel reports and the size the editor paints have to be the same
  number, and stay the same number when the artist changes her mind — which is
  what the old spinner could not manage.
*/
describe("applySpanMark", () => {
  const mounted = (html: string): HTMLElement => {
    document.body.innerHTML = "";
    const root = document.createElement("div");
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
  };

  /** Selects the text of the first element matching, as clicking a word would. */
  const select = (root: HTMLElement, selector: string) => {
    const range = document.createRange();
    range.selectNodeContents(root.querySelector(selector) ?? root);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /** The innermost size mark — the one the model reads back. */
  const marked = (root: HTMLElement): Element => {
    const all = root.querySelectorAll("[data-rt-size]");
    return all[all.length - 1];
  };

  /** What the browser actually paints, walking the `em` chain to the box. */
  const paintedSize = (node: Element, root: HTMLElement): number => {
    let painted = 1;
    let el: Element | null = node;
    while (el && el !== root) {
      const size = (el as HTMLElement).style.fontSize;
      if (size.endsWith("em")) painted *= Number(size.slice(0, -2));
      el = el.parentElement;
    }
    return painted;
  };

  it("paints the size it stores, inside a run that already had one", () => {
    const root = mounted(
      '<div><span data-rt-size="0.5" style="font-size: 0.5em">word</span></div>',
    );
    select(root, "span");

    applySpanMark({ size: 1.5 }, BUILT_IN_FONTS, root);

    const doc = docFromElement(root, BUILT_IN_FONTS);
    expect(doc).toEqual([{ runs: [{ text: "word", size: 1.5 }] }]);
    expect(paintedSize(marked(root), root)).toBeCloseTo(1.5, 5);
  });

  /*
    The regression the artist reported as the size moving on its own. Changing
    her mind twice used to multiply rather than replace, so a size she had
    already used came back as something else.
  */
  it("lands back on the same size when she changes her mind twice", () => {
    const root = mounted("<div>word</div>");

    for (const size of [1.3, 0.5, 1.3]) {
      select(root, "div");
      applySpanMark({ size }, BUILT_IN_FONTS, root);
    }

    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([{ runs: [{ text: "word", size: 1.3 }] }]);
    expect(paintedSize(marked(root), root)).toBeCloseTo(1.3, 5);
  });

  it("arms a collapsed caret without compounding what it sits in", () => {
    const root = mounted(
      '<div><span data-rt-size="0.5" style="font-size: 0.5em">word</span></div>',
    );
    const text = root.querySelector("span")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 2);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    applySpanMark({ size: 2 }, BUILT_IN_FONTS, root);

    const armed = root.querySelector('[data-rt-size="2"]')!;
    expect(paintedSize(armed, root)).toBeCloseTo(2, 5);
  });

  it("applies a colour to text that carries none", () => {
    const root = mounted("<div>word</div>");
    select(root, "div");
    applySpanMark({ colour: "#aabbcc" }, BUILT_IN_FONTS, root);
    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "word", colour: "#aabbcc" }] },
    ]);
  });

  /*
    The regression the artist reported as "it will not go back to black".

    A new mark wraps the selection, so the colour it is replacing ends up
    *inside* the new span — and the inner colour is the one the browser paints
    and the one `marksOf` reads back. Nothing was stale: the old colour was
    still there, winning.
  */
  it("replaces a colour the selection already had, rather than wrapping it", () => {
    const root = mounted(
      '<div><span data-rt-colour="#2140d6" style="color: #2140d6">word</span></div>',
    );
    // The whole line, as dragging across it or triple-clicking gives — which
    // puts the coloured span *inside* the range rather than around it.
    select(root, "div");

    applySpanMark({ colour: "#101010" }, BUILT_IN_FONTS, root);

    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "word", colour: "#101010" }] },
    ]);
    expect(root.querySelectorAll("[data-rt-colour]")).toHaveLength(1);
  });

  it("replaces a face the selection already had", () => {
    const [first, second] = BUILT_IN_FONTS;
    const root = mounted(`<div><span data-rt-font="${second.id}">word</span></div>`);
    select(root, "div");

    applySpanMark({ font: first.id }, BUILT_IN_FONTS, root);

    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "word", font: first.id }] },
    ]);
  });

  /*
    Selecting a coloured word by double-clicking puts the range *inside* the
    span instead, so the new mark nests within the old one and the innermost —
    the new one — is what is read and painted. That case always worked; it is
    why the fault looked intermittent rather than total.
  */
  it("replaces it from inside the old span too, leaving one mark behind", () => {
    const root = mounted(
      '<div><span data-rt-colour="#2140d6" style="color: #2140d6">word</span></div>',
    );
    select(root, "span");

    applySpanMark({ colour: "#101010" }, BUILT_IN_FONTS, root);

    expect(docFromElement(root, BUILT_IN_FONTS)).toEqual([
      { runs: [{ text: "word", colour: "#101010" }] },
    ]);
  });
});
