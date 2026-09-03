"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { makeSiteLive } from "@/app/admin/actions";
import { useAction } from "./use-action";
import { onWrite } from "./write-bus";

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
 * The state is still the server's answer and still a hash of the content —
 * never a local flag saying "we just published, so we must be live", which
 * goes stale the moment she types the next character. What changed is *when*
 * it is computed. It used to be a prop from the admin layout, which meant
 * hashing the entire site on every admin render; since every mutation
 * revalidated that layout, the artist paid for a whole-site read on every
 * keystroke, and enough of them at once exceeded the Worker's CPU limit. So
 * the badge fetches its own answer, at the four moments it can have changed.
 */

type State = { live: boolean; publishedAt: string | null };

/** Long enough that a burst of saves settles into one question. */
const SETTLE_MS = 1500;

export function PublishButton() {
  const { run, pending, error } = useAction();
  const [state, setState] = useState<State | null>(null);
  const pathname = usePathname();

  /*
    So the publish handler can re-ask once the write has landed. The checking
    itself belongs to the effect — it owns the listeners and the cancellation —
    so what leaves it is a handle, not a copy of the logic.
  */
  const recheck = useRef<() => void>(() => {});

  /*
    One effect, because the four moments share a subscription and a guard.
    `pathname` is the dependency: the settings pages save through a plain
    <form action>, which never reaches the write bus, so returning from one has
    to be a moment that re-asks.
  */
  useEffect(() => {
    let alive = true;
    let settling: ReturnType<typeof setTimeout> | undefined;
    /*
      An id per request, so a slow answer cannot overwrite a newer one. Two
      checks are easily in flight at once — a write lands while the tab regains
      focus — and the older reply arriving second would put the badge back to
      what it said before the write.
    */
    let issued = 0;

    const check = () => {
      const ticket = (issued += 1);
      void (async () => {
        try {
          const response = await fetch("/api/admin/publish-state", { cache: "no-store" });
          if (!response.ok) return;
          const next = (await response.json()) as State;
          if (alive && ticket === issued) setState(next);
        } catch (cause) {
          // A failed check leaves the badge as it was. It is a status
          // indicator, not a control — a network error reported here would be
          // noise beside the error the failed write itself already surfaces.
          console.error("[admin] could not read the publish state", cause);
        }
      })();
    };

    recheck.current = check;
    check();

    // After a write, once the burst has settled. Typing in a text box is a
    // burst of one write; a group drag is a burst of several.
    const unsubscribe = onWrite(() => {
      clearTimeout(settling);
      settling = setTimeout(check, SETTLE_MS);
    });

    // And on returning to the tab, which is the one way the site can have
    // changed without this browser knowing — she publishes from her phone, or
    // has the studio open in two windows.
    window.addEventListener("focus", check);

    return () => {
      alive = false;
      clearTimeout(settling);
      unsubscribe();
      window.removeEventListener("focus", check);
    };
  }, [pathname]);

  const publish = () =>
    run(
      makeSiteLive().then(() => recheck.current()),
      "Making the site live",
    );

  // Before the first answer there is nothing honest to say. The slot keeps its
  // width so the controls beside it do not jump when the answer lands.
  if (state === null) {
    return <span className="text-graphite/60 text-xs">Checking…</span>;
  }

  if (state.live && !pending) {
    return (
      <span
        className="text-graphite flex items-center gap-1.5 text-xs"
        title={state.publishedAt ? `Last published ${formatted(state.publishedAt)}` : undefined}
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

/**
 * Formatted in the browser now that the value crosses as an ISO string.
 *
 * The layout used to format it server-side, which on a Worker means the
 * *server's* locale and timezone. The artist is in the UK and so is the
 * worker's answer by luck rather than by design; here it is her own machine
 * that decides, which is what a "last published" time should follow.
 */
const formatted = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
