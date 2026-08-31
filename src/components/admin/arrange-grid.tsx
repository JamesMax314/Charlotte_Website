"use client";

import Image from "next/image";
import Link from "next/link";
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
import { reorderArtworks } from "@/app/admin/actions";

const STATUS_LABEL: Record<Artwork["status"], string> = {
  published: "Live",
  draft: "Draft",
  archived: "Archived",
};

function Tile({ artwork }: { artwork: Artwork }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: artwork.id,
  });
  const image = artwork.images[0];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-line bg-paper relative border ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
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
        <div className="bg-paper-sunk aspect-square overflow-hidden">
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

      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        <Link
          href={`/admin/artworks/${artwork.id}`}
          className="hover:text-biro truncate text-sm transition-colors"
        >
          {artwork.title}
        </Link>
        <span className="text-graphite shrink-0 text-[10px] tracking-wide uppercase">
          {STATUS_LABEL[artwork.status]}
        </span>
      </div>
    </li>
  );
}

export function ArrangeGrid({ artworks }: { artworks: Artwork[] }) {
  const [items, setItems] = useState(artworks);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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
      await reorderArtworks(next.map((a) => a.id));
      setSaved(true);
    });
  }

  return (
    <div>
      <div className="text-graphite mb-4 flex h-5 items-center gap-2 text-xs" aria-live="polite">
        {pending ? "Saving order…" : saved ? "Order saved" : "Drag to rearrange"}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((a) => a.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((artwork) => (
              <Tile key={artwork.id} artwork={artwork} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
