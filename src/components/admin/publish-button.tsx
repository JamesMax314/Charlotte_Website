"use client";

import { makeSiteLive } from "@/app/admin/actions";
import { useAction } from "./use-action";

/**
 * "Make live", and the badge that says when there is nothing to make live.
 *
 * The artist edits a draft of the whole site: her saves are immediate but
 * private, and nothing reaches a visitor until this runs. That is what lets
 * her spend an afternoon rearranging a wall, rewriting the About copy and
 * adding three pieces, and have all of it appear at once rather than a visitor
 * catching the site halfway through.
 *
 * Live is a state, not a button. Rendering it as a disabled button invites the
 * artist to press a control that does nothing and cannot say why, so when
 * there is nothing to publish there is nothing to press.
 *
 * `live` comes from the server on every render and is never mirrored into
 * local state. An optimistic "we just published, so we must be live" flag is
 * the obvious optimisation and it is wrong: the artist's next edit revalidates
 * this layout with `live: false`, the stale flag wins, and the badge sits on
 * "Live" while the site she is looking at is not — which is the one thing this
 * control exists to tell her. Every admin action already revalidates the
 * layout, so the server's answer arrives on its own, and it is the only one
 * worth trusting because it is the one that hashed the content.
 */
export function PublishButton({
  live,
  publishedAt,
}: {
  live: boolean;
  publishedAt: string | null;
}) {
  const { run, pending, error } = useAction();

  const publish = () => run(makeSiteLive(), "Making the site live");

  if (live && !pending) {
    return (
      <span
        className="text-graphite flex items-center gap-1.5 text-xs"
        title={publishedAt ? `Last published ${publishedAt}` : undefined}
      >
        {/*
          `aria-hidden` on the dot and the word carrying the meaning: a green
          circle is not information to a screen reader, and "Live" already is.
        */}
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" />
        Live
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={publish}
        disabled={pending}
        className="bg-accent text-accent-ink hover:bg-ink hover:text-paper px-3 py-1.5 text-xs transition-colors disabled:opacity-60"
        title="Publish every change you have made since the site last went live"
      >
        {pending ? "Making live…" : "Make live"}
      </button>
    </span>
  );
}
