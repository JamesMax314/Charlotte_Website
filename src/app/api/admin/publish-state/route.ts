import { hasValidSession } from "@/lib/auth";
import { getPublishState } from "@/lib/publish";

export const dynamic = "force-dynamic";

/**
 * Whether the draft and the live site are identical.
 *
 * This exists so that answering the question is a request of its own.
 *
 * It used to be a read in the admin layout, which meant every admin render
 * paid for it — and because every mutation revalidated that layout, "every
 * render" included one per keystroke in a wall text box. The answer is
 * expensive by construction: it reads every content table and hashes what they
 * hold, which is exactly what makes it trustworthy and exactly what makes it
 * the wrong thing to put on a hot path. Cloudflare's free tier allows roughly
 * 10ms of CPU per request, and stacking a whole-site hash on top of a save is
 * how the artist met `1102 Worker exceeded resource limit`.
 *
 * Given its own route it costs its own invocation, with its own budget, and
 * only when something asks. Nothing else waits behind it.
 *
 * Gated here rather than by a layout: route handlers are routed independently,
 * exactly like server actions.
 */
export async function GET() {
  if (!(await hasValidSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { live, publishedAt } = await getPublishState();
  return Response.json(
    { live, publishedAt: publishedAt === null ? null : publishedAt.toISOString() },
    // The whole point is a fresh answer; a cached one would report the site
    // live while the artist looks at an unpublished change.
    { headers: { "cache-control": "no-store" } },
  );
}
