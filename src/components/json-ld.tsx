import { jsonLdScriptContent } from "@/lib/seo";

/**
 * Structured data, as one `@graph` per page.
 *
 * A wrapper thin enough to need no test of its own: the escaping that makes it
 * safe lives in `jsonLdScriptContent`, which is pure and covered. One element
 * per page rather than one per node, so a crawler reads a single document and
 * the nodes can refer to each other by `@id`.
 */
export function JsonLd({ nodes }: { nodes: Record<string, unknown>[] }) {
  if (nodes.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(nodes) }}
    />
  );
}
