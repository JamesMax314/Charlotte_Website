"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Artwork } from "@/lib/artworks";
import { isSoldOut, soleListing } from "@/lib/artworks";
import { formatPrice } from "@/lib/format";
import {
  createArtworkDraft,
  deleteArtworkPermanently,
  reorderArtworks,
  setArtworkSoldOut,
  setArtworkStatus,
} from "@/app/admin/actions";
import { ArtworkDialog } from "./artwork-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { ContextMenu, Icons, type MenuEntry } from "./context-menu";
import { useAction } from "./use-action";

const STATUS_LABEL: Record<Artwork["status"], string> = {
  published: "Live",
  draft: "Draft",
  archived: "Archived",
};

const BADGE = "bg-ink/80 text-paper px-1.5 py-0.5 text-[9px] tracking-wide uppercase";

/** A piece that exists in the database but not yet in the list we were sent. */
const blankArtwork = (id: string): Artwork => ({
  id,
  slug: "",
  title: "Untitled",
  year: new Date().getFullYear(),
  medium: "",
  description: "",
  status: "draft",
  sortOrder: 0,
  isFeatured: false,
  images: [],
  listings: [],
});

function Tile({
  artwork,
  onOpen,
  onMenu,
}: {
  artwork: Artwork;
  onOpen: () => void;
  onMenu: (x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: artwork.id,
  });
  const image = artwork.images[0];
  const listing = soleListing(artwork);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-line bg-paper relative border ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(event.clientX, event.clientY);
      }}
    >
      {/*
        The whole tile is the drag handle — on a touch screen a small grip is a
        miss target. TouchSensor's delay keeps taps and scrolls working.
      */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none active:cursor-grabbing"
        aria-label={`Reorder ${artwork.title}`}
      >
        <div className="bg-paper-sunk aspect-[3/4] overflow-hidden">
          {image ? (
            <Image
              src={image.src}
              alt=""
              width={image.width}
              height={image.height}
              sizes="200px"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-graphite flex h-full items-center justify-center text-xs">
              No image
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute top-1 left-1 flex gap-1">
        {artwork.status !== "published" && (
          <span className={BADGE}>{STATUS_LABEL[artwork.status]}</span>
        )}
        {isSoldOut(artwork) && <span className={BADGE}>Sold out</span>}
      </div>

      {/*
        iPadOS has no right-click, and a long press cannot stand in for one
        here: dnd-kit's TouchSensor claims the hold at 180ms to start the drag
        the artist also needs. So the menu gets a button of its own.
      */}
      <button
        type="button"
        onClick={(event) => onMenu(event.clientX, event.clientY)}
        aria-label={`Actions for ${artwork.title}`}
        className="bg-paper/85 border-line text-graphite hover:text-ink absolute top-1 right-1 border px-2 py-0.5 text-sm leading-tight transition-colors"
      >
        ⋯
      </button>

      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="hover:text-accent truncate text-left text-sm transition-colors"
        >
          {artwork.title}
        </button>
        <span className="text-graphite shrink-0 text-xs tabular-nums">
          {listing ? formatPrice(listing.pricePence) : "—"}
        </span>
      </div>
    </li>
  );
}

export function ArrangeGrid({ artworks }: { artworks: Artwork[] }) {
  const router = useRouter();
  const [items, setItems] = useState(artworks);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const { run, error } = useAction();

  const [dialog, setDialog] = useState<{ artwork: Artwork; isNew: boolean } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Artwork | null>(null);
  const [adding, setAdding] = useState(false);

  // Resync when the server sends a fresh list (a piece added or removed
  // elsewhere). Adjusting state during render rather than in an effect avoids
  // the cascading re-render that useEffect + setState would cause.
  const [lastServerList, setLastServerList] = useState(artworks);
  if (artworks !== lastServerList) {
    setLastServerList(artworks);
    setItems(artworks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const next = arrayMove(
      items,
      items.findIndex((a) => a.id === active.id),
      items.findIndex((a) => a.id === over.id),
    );
    setItems(next);
    setSaved(false);

    startTransition(async () => {
      run(
        reorderArtworks(next.map((a) => a.id)).then(() => setSaved(true)),
        "Saving the order",
      );
    });
  }

  /*
    The row has to exist before an image can be attached to it, so the new
    piece is created first and the dialog opens on it. Cancelling deletes it
    again — see createArtworkDraft.
  */
  async function addPiece() {
    setAdding(true);
    try {
      const id = await createArtworkDraft();
      setDialog({ artwork: blankArtwork(id), isNew: true });
    } catch (cause) {
      console.error("[admin] Adding a piece failed", cause);
    } finally {
      setAdding(false);
    }
  }

  function openMenu(x: number, y: number, artwork: Artwork) {
    const soldOut = isSoldOut(artwork);
    const entries: MenuEntry[] = [
      {
        label: "Edit details",
        icon: Icons.pencil,
        onSelect: () => setDialog({ artwork, isNew: false }),
      },
    ];

    // Availability lives on the listing, so there is nothing to toggle until
    // the piece has one.
    if (soleListing(artwork)) {
      entries.push({
        label: soldOut ? "Mark as for sale" : "Mark as sold out",
        icon: Icons.tag,
        onSelect: () =>
          run(
            setArtworkSoldOut(artwork.id, !soldOut).then(() => router.refresh()),
            "Changing availability",
          ),
      });
    }

    entries.push({
      label: artwork.status === "published" ? "Make it a draft" : "Publish it",
      icon: Icons.eye,
      onSelect: () =>
        run(
          setArtworkStatus(artwork.id, artwork.status === "published" ? "draft" : "published").then(
            () => router.refresh(),
          ),
          "Changing who can see it",
        ),
    });

    if (artwork.status !== "archived") {
      entries.push({
        label: "Move to the archive",
        icon: Icons.box,
        onSelect: () =>
          run(
            setArtworkStatus(artwork.id, "archived").then(() => router.refresh()),
            "Archiving the piece",
          ),
      });
    }

    entries.push({
      label: "Delete for good",
      icon: Icons.trash,
      danger: true,
      onSelect: () => setPendingDelete(artwork),
    });

    setMenu({ x, y, entries });
  }

  return (
    <div>
      <div className="text-graphite mb-4 flex h-5 items-center gap-2 text-xs" aria-live="polite">
        {pending ? "Saving order…" : saved ? "Order saved" : "Drag to rearrange"}
      </div>

      {/*
        A stable id is required, not optional. dnd-kit derives the
        aria-describedby target from a module-level counter that starts at zero
        on the server but has already advanced on the client, so without this
        every sortable item hydrates with a mismatched attribute.
      */}
      <DndContext
        id="arrange-artworks"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((a) => a.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((artwork) => (
              <Tile
                key={artwork.id}
                artwork={artwork}
                onOpen={() => setDialog({ artwork, isNew: false })}
                onMenu={(x, y) => openMenu(x, y, artwork)}
              />
            ))}

            {/* The new piece appears where this tile stands. */}
            <li>
              <button
                type="button"
                onClick={addPiece}
                disabled={adding}
                className="border-line text-graphite hover:border-ink hover:text-ink flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 border border-dashed text-sm transition-colors disabled:opacity-60"
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  +
                </span>
                {adding ? "Adding…" : "Add a piece"}
              </button>
            </li>
          </ul>
        </SortableContext>
      </DndContext>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}

      {dialog && (
        <ArtworkDialog
          open
          artwork={dialog.artwork}
          isNew={dialog.isNew}
          onCancel={() => {
            // A piece she never saved leaves nothing behind.
            if (dialog.isNew) {
              run(
                deleteArtworkPermanently(dialog.artwork.id).then(() => router.refresh()),
                "Discarding the piece",
              );
            }
            setDialog(null);
          }}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this piece?"
        body={`“${pendingDelete?.title ?? ""}” and its photographs will be removed for good. Archiving keeps its link working instead.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const artwork = pendingDelete;
          setPendingDelete(null);
          if (!artwork) return;
          setItems((current) => current.filter((a) => a.id !== artwork.id));
          run(
            deleteArtworkPermanently(artwork.id).then(() => router.refresh()),
            "Deleting the piece",
          );
        }}
      />
    </div>
  );
}
