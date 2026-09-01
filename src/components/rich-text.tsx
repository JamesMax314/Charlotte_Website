import Link from "next/link";
import { resolveFontFamily, type FontOption } from "@/lib/fonts";
import type { RichDoc, RichParagraph, RichRun } from "@/lib/rich-text";

/**
 * Renders a rich-text document as React elements.
 *
 * Never `dangerouslySetInnerHTML`. The model exists so that the path from
 * "what the artist typed" to "what a visitor's browser executes" does not
 * exist: marks become elements here, and anything the model does not describe
 * cannot be expressed. A sanitiser that has to stay ahead of every parser
 * quirk is the thing this avoids having.
 */

const isExternal = (href: string): boolean => !href.startsWith("/");

function Run({ run, fonts }: { run: RichRun; fonts: FontOption[] }) {
  let node: React.ReactNode = run.text;

  if (run.bold) node = <strong>{node}</strong>;
  if (run.italic) node = <em>{node}</em>;
  if (run.underline) node = <u>{node}</u>;

  if (run.colour !== undefined || run.font !== undefined || run.size !== undefined) {
    node = (
      <span
        style={{
          ...(run.colour === undefined ? {} : { color: run.colour }),
          ...(run.font === undefined ? {} : { fontFamily: resolveFontFamily(run.font, fonts) }),
          // `em`, not a fixed size: the wall sizes its boxes in `cqw` so type
          // scales with the arrangement, and a run in pixels would stop.
          ...(run.size === undefined ? {} : { fontSize: `${run.size}em` }),
        }}
      >
        {node}
      </span>
    );
  }

  if (run.href !== undefined) {
    // A link out gets the site's standard treatment; a link to her own pages
    // stays in the tab and goes through the router.
    node = isExternal(run.href) ? (
      <a
        href={run.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {node}
      </a>
    ) : (
      <Link href={run.href} className="underline underline-offset-2">
        {node}
      </Link>
    );
  }

  return node;
}

const Runs = ({ runs, fonts }: { runs: RichParagraph; fonts: FontOption[] }) => (
  <>
    {runs.map((run, index) => (
      <Run key={index} run={run} fonts={fonts} />
    ))}
  </>
);

/**
 * A document inside a single element — the wall's text boxes.
 *
 * Paragraphs are separated by line breaks rather than by `<p>`, because the
 * wall promotes its largest box to the page `<h1>` and a heading may not
 * contain paragraphs. The box keeps `whitespace-pre-wrap`, so a blank
 * paragraph is a blank line exactly as it was before rich text.
 */
export function RichTextInline({ doc, fonts }: { doc: RichDoc; fonts: FontOption[] }) {
  return (
    <>
      {doc.map((paragraph, index) => (
        <span key={index}>
          {index > 0 && <br />}
          <Runs runs={paragraph} fonts={fonts} />
        </span>
      ))}
    </>
  );
}

/**
 * A document as blocks — the About, Contact and Privacy copy.
 *
 * A blank paragraph is what separated two paragraphs when this copy was plain
 * text, so it is dropped here rather than rendered as an empty `<p>`.
 */
export function RichTextBlocks({
  doc,
  fonts,
  className = "",
}: {
  doc: RichDoc;
  fonts: FontOption[];
  className?: string;
}) {
  return (
    <>
      {doc
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph, index) => (
          <p key={index} className={className}>
            <Runs runs={paragraph} fonts={fonts} />
          </p>
        ))}
    </>
  );
}
