"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uploadImage } from "@/lib/client-upload";

type Item = { id: string; src: string; alt: string; width: number; height: number };

/**
 * Serves both collections — store artworks and portfolio pieces.
 *
 * The mutations differ per collection so they are injected, but the upload
 * pipeline (downscale, responsive ladder, blur placeholder) is shared
 * deliberately: two copies of it would drift.
 */
type Props = {
  parentId: string;
  /** Which field the upload endpoint expects the parent id under. */
  uploadField: "artworkId" | "portfolioItemId";
  images: Item[];
  reorder: (parentId: string, ids: string[]) => Promise<void>;
  updateAlt: (id: string, alt: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  heading?: string;
  hint?: string;
};

function Thumb({
  item,
  onDelete,
  updateAlt,
}: {
  item: Item;
  onDelete: (id: string) => void;
  updateAlt: (id: string, alt: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [alt, setAlt] = useState(item.alt);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-line bg-paper border ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="bg-paper-sunk aspect-square cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        aria-label={`Reorder image`}
      >
        <Image
          src={item.src}
          alt=""
          width={item.width}
          height={item.height}
          sizes="200px"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-col gap-2 p-2">
        <label className="text-graphite text-[10px]">
          Describe it for screen readers
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => alt !== item.alt && void updateAlt(item.id, alt)}
            className="border-line focus:border-ink mt-1 w-full border bg-transparent px-2 py-1 text-xs outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="text-graphite self-start text-[10px] underline underline-offset-2 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function ImageManager({
  parentId,
  uploadField,
  images,
  reorder,
  updateAlt,
  remove,
  heading = "Images",
  hint = "Drag to reorder. The first image is the one shown in the gallery.",
}: Props) {
  const [items, setItems] = useState(images);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  async function upload(files: FileList) {
    setError(null);
    for (const [index, file] of Array.from(files).entries()) {
      setBusy(`Preparing ${index + 1} of ${files.length}…`);
      try {
        const uploaded = await uploadImage(file, { field: uploadField, parentId });
        setItems((current) => [
          ...current,
          {
            id: uploaded.id,
            src: uploaded.src,
            alt: "",
            width: uploaded.width,
            height: uploaded.height,
          },
        ]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Upload failed.");
      }
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    );
    setItems(next);
    startTransition(() => {
      void reorder(
        parentId,
        next.map((i) => i.id),
      );
    });
  }

  function handleDelete(id: string) {
    setItems((current) => current.filter((i) => i.id !== id));
    startTransition(() => {
      void remove(id);
    });
  }

  return (
    <section>
      <h2 className="font-display text-lg tracking-tight">{heading}</h2>
      <p className="text-graphite mt-1 mb-4 text-xs">{hint}</p>

      {items.length > 0 && (
        <DndContext
          id="arrange-artwork-images"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <Thumb key={item.id} item={item} onDelete={handleDelete} updateAlt={updateAlt} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && upload(e.target.files)}
        className="text-graphite border-line file:bg-ink file:text-paper w-full border border-dashed p-4 text-xs file:mr-3 file:border-0 file:px-4 file:py-2 file:text-xs"
      />

      {busy && (
        <p className="text-graphite mt-2 text-xs" aria-live="polite">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
