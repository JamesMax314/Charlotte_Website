"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { navLabel, type SitePage } from "@/lib/site-pages";
import { createSitePage, reorderSitePages } from "@/app/admin/site-pages-actions";
import { useAction } from "./use-action";

/**
 * The artist's own pages, in the middle of the studio's top bar.
 *
 * It stands where the same links stand on the public site, and it is the whole
 * interface for them: drag one to move it along the bar, click it to edit the
 * page, press + to add another. There is no separate list screen, because the
 * thing being arranged *is* the top bar.
 */

function PageLink({
  page,
  active,
  suppressClick,
}: {
  page: SitePage;
  active: boolean;
  suppressClick: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      /*
        `flex` blockifies the anchor inside. Left inline it is only as tall as
        the glyphs, so it sits half a pixel off the Illustration link beside
        it — which is a direct flex child and therefore already blockified.
      */
      className={`flex ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      {/*
        The link is its own drag handle: a separate grip in a bar this size
        would be a miss target on the tablet the artist works on. The pointer
        sensor only engages after a few pixels of travel, so a click is still a
        click — but the browser fires that click after a drag as well, which is
        what `suppressClick` is for.
      */}
      <Link
        href={`/admin/pages/${page.id}`}
        {...attributes}
        {...listeners}
        onClick={(event) => {
          if (suppressClick()) event.preventDefault();
        }}
        className={`hover:text-accent cursor-grab touch-none text-xs whitespace-nowrap transition-colors active:cursor-grabbing ${
          active ? "text-ink" : "text-graphite"
        }`}
      >
        {navLabel(page)}
        {/* A draft is in the studio's bar but not the site's; say so quietly. */}
        {page.status === "draft" && <span className="text-graphite/70"> · draft</span>}
      </Link>
    </li>
  );
}

export function NavPages({ pages }: { pages: SitePage[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(pages);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const { run, error } = useAction();

  /*
    A drag ends with a click on the link that was dragged, because pointerdown
    and pointerup both land on it. Cleared on a zero timeout rather than
    immediately: the click is dispatched synchronously after pointerup, so
    anything that resets the flag in the same tick resets it too early and the
    artist is navigated away from the bar she was rearranging.
  */
  const draggingRef = useRef(false);

  // Resync when the server sends a fresh list, adjusting state during render
  // rather than in an effect — the pattern the store's grid uses.
  const [lastServerList, setLastServerList] = useState(pages);
  if (pages !== lastServerList) {
    setLastServerList(pages);
    setItems(pages);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    setTimeout(() => {
      draggingRef.current = false;
    }, 0);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const next = arrayMove(
      items,
      items.findIndex((p) => p.id === active.id),
      items.findIndex((p) => p.id === over.id),
    );
    setItems(next);

    startTransition(() => {
      run(reorderSitePages(next.map((p) => p.id)), "Saving the order of your pages");
    });
  }

  async function addPage() {
    setAdding(true);
    try {
      const id = await createSitePage();
      router.push(`/admin/pages/${id}`);
    } catch (cause) {
      console.error("[admin] Adding a page failed", cause);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {/*
        The home wall leads the bar here for the same reason it leads the site's: this
        strip is meant to be a preview of the nav the artist is arranging, and
        one that opened straight onto her custom pages would not be. It sits
        outside the DndContext because it is not one of her pages — there is no
        row to reorder, and it is always first.
      */}
      <Link
        href="/admin/portfolio"
        className={`hover:text-accent text-xs whitespace-nowrap transition-colors ${
          pathname === "/admin/portfolio" ? "text-ink" : "text-graphite"
        }`}
      >
        Illustration
      </Link>

      {/*
        An explicit id is required, not optional: dnd-kit derives its
        aria-describedby target from a module-level counter that starts at zero
        on the server but has already advanced on the client.
      */}
      <DndContext
        id="arrange-nav-pages"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          draggingRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() =>
          setTimeout(() => {
            draggingRef.current = false;
          }, 0)
        }
      >
        <SortableContext items={items.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {items.map((page) => (
              <PageLink
                key={page.id}
                page={page}
                active={pathname === `/admin/pages/${page.id}`}
                suppressClick={() => draggingRef.current}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addPage}
        disabled={adding}
        title="Add a page to the top bar"
        aria-label="Add a page to the top bar"
        className="border-line text-graphite hover:border-ink hover:text-ink flex h-5 w-5 shrink-0 items-center justify-center border text-sm leading-none transition-colors disabled:opacity-60"
      >
        <span aria-hidden="true">+</span>
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
