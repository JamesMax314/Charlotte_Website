"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The "unpublished changes" pill, on the public site, for the artist only.
 *
 * Whether to show it is a question the server can only answer by hashing every
 * content table, so it is asked after the page has rendered rather than
 * during. The page is the artist's own site as a visitor would see it; making
 * her wait on a whole-site read to be told about a badge in the corner is the
 * wrong order, and on Cloudflare's free tier it is CPU spent inside the page's
 * own request budget.
 *
 * Nothing is rendered until the answer arrives, which is right for a marker
 * whose entire job is to appear only when there is something to say. Its
 * parent has already established that she is signed in and being served the
 * draft — this only decides whether the draft differs from what is live.
 */
export function DraftPill() {
  const [unpublished, setUnpublished] = useState(false);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const response = await fetch("/api/admin/publish-state", { cache: "no-store" });
        if (!response.ok) return;
        const { live } = (await response.json()) as { live: boolean };
        if (current) setUnpublished(!live);
      } catch (cause) {
        // Silent. A marker that cannot check is a marker that says nothing,
        // which is the same as the site being live — and the studio's own
        // badge is the place that reports a real problem.
        console.error("[site] could not read the publish state", cause);
      }
    })();
    return () => {
      current = false;
    };
  }, []);

  if (!unpublished) return null;

  return (
    /*
      Fixed and out of the flow on purpose. A banner along the top would push
      the page down and change the spacing above the header, so she would be
      checking a layout no visitor will ever see — the one thing this must not
      do.
    */
    <div className="fixed bottom-3 left-3 z-50 print:hidden">
      <Link
        href="/admin"
        className="border-line bg-paper text-graphite hover:border-ink flex items-center gap-1.5 border px-2.5 py-1.5 text-xs shadow-sm transition-colors"
      >
        <span aria-hidden className="bg-accent size-1.5 rounded-full" />
        Unpublished changes — only you can see this
      </Link>
    </div>
  );
}
