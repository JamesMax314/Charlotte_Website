"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SitePage } from "@/lib/site-pages";
import { deleteSitePage, updateSitePage } from "@/app/admin/site-pages-actions";
import { ConfirmDialog } from "./confirm-dialog";
import { FIELD, SECONDARY_BUTTON } from "./styles";
import { useAction } from "./use-action";

/**
 * What a custom page is, as opposed to what is on it: its nav label, its URL,
 * and whether visitors can see it.
 *
 * The title and the slug sit behind a Save button because they are typed —
 * a write per keystroke would fight the artist and rewrite the slug under her
 * cursor. Publishing is a switch, and saves the moment it is flipped, so the
 * studio never claims the page is live while it is not.
 */
export function SitePageForm({ page }: { page: SitePage }) {
  const router = useRouter();
  const { run, pending, error } = useAction();

  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [published, setPublished] = useState(page.status === "published");
  const [confirming, setConfirming] = useState(false);

  const dirty = title !== page.title || slug !== page.slug;

  return (
    <div className="border-line bg-paper-sunk mb-8 border p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-48 flex-1">
          <span className="text-graphite mb-1 block text-xs tracking-[0.18em] uppercase">
            Name in the top bar
          </span>
          <input
            className={FIELD}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Exhibitions"
          />
        </label>

        <label className="min-w-48 flex-1">
          <span className="text-graphite mb-1 block text-xs tracking-[0.18em] uppercase">
            Its web address
          </span>
          <div className="flex items-center gap-1">
            <span className="text-graphite text-sm">/</span>
            <input
              className={FIELD}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="exhibitions"
            />
          </div>
        </label>

        <button
          type="button"
          disabled={!dirty || pending}
          className={SECONDARY_BUTTON}
          onClick={() =>
            run(
              updateSitePage(page.id, { title, slug }).then(() => router.refresh()),
              "Saving the page",
            )
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => {
              const next = event.target.checked;
              setPublished(next);
              run(
                updateSitePage(page.id, { status: next ? "published" : "draft" }).then(() =>
                  router.refresh(),
                ),
                "Changing who can see this page",
              );
            }}
          />
          Show it in the top bar
        </label>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-graphite text-xs transition-colors hover:text-red-700"
        >
          Delete this page
        </button>
      </div>

      {/*
        A slug the artist types is not always the slug she gets: reserved names
        and names another page already holds are adjusted on save, and the
        field above then shows what was actually stored.
      */}
      <p className="text-graphite mt-3 text-xs">
        Leave the address blank to have it follow the name. A few addresses are already taken by the
        site — <em>about</em>, <em>contact</em>, <em>privacy</em>, <em>shop</em> and <em>work</em> —
        so a page asking for one of those gets a number added.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this page?"
        body={`“${page.title}”, its link in the top bar, and everything arranged on it will be removed for good.`}
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          run(
            deleteSitePage(page.id).then(() => router.push("/admin/portfolio")),
            "Deleting the page",
          );
        }}
      />
    </div>
  );
}
