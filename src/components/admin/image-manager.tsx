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
import { WIDTH_LADDER } from "@/image-loader";

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

const MAX_EDGE = WIDTH_LADDER[WIDTH_LADDER.length - 1];

function render(bitmap: ImageBitmap, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Downscales in the browser and writes the whole responsive ladder.
 *
 * Two reasons this happens client-side: the artist uploads from a phone, where
 * a 60MB camera file over mobile data stalls; and Workers has no image
 * optimizer, so the derivatives have to exist as real objects (see
 * src/image-loader.ts). Also grabs the blur placeholder while the bitmap is
 * already decoded.
 */
async function prepare(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const master = await render(bitmap, width, height, 0.86);

  // Never upscale: a 900px original gets no 1600px derivative.
  const variants = new Map<number, Blob>();
  for (const target of WIDTH_LADDER) {
    if (target >= width) continue;
    const variant = await render(bitmap, target, Math.round((target * height) / width), 0.82);
    if (variant) variants.set(target, variant);
  }

  const tiny = document.createElement("canvas");
  tiny.width = 16;
  tiny.height = Math.max(1, Math.round((16 * height) / width));
  tiny.getContext("2d")?.drawImage(bitmap, 0, 0, tiny.width, tiny.height);
  bitmap.close();

  return { master, variants, width, height, lqip: tiny.toDataURL("image/jpeg", 0.4) };
}

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
        const { master, variants, width, height, lqip } = await prepare(file);
        if (!master) throw new Error("Could not read that image.");

        const name = file.name.replace(/\.\w+$/, ".jpg");
        const body = new FormData();
        body.set("file", new File([master], name, { type: "image/jpeg" }));
        body.set(uploadField, parentId);
        body.set("width", String(width));
        body.set("height", String(height));
        body.set("lqip", lqip);
        for (const [target, blob] of variants) {
          body.set(`variant-${target}`, new File([blob], name, { type: "image/jpeg" }));
        }

        setBusy(`Uploading ${index + 1} of ${files.length}…`);
        const response = await fetch("/api/admin/upload", { method: "POST", body });
        const result = (await response.json()) as { id?: string; src?: string; error?: string };
        if (!response.ok || !result.id || !result.src) {
          throw new Error(result.error ?? "Upload failed.");
        }
        setItems((current) => [
          ...current,
          { id: result.id!, src: result.src!, alt: "", width, height },
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
