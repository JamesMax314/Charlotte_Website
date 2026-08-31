"use client";

import { useEffect, useRef } from "react";

/**
 * Confirmation built on <dialog>.
 *
 * showModal() gives focus trapping, page inertness and Escape-to-close from the
 * platform. Deliberately not window.confirm(), which blocks the whole page and
 * cannot be styled.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="border-line bg-paper text-ink m-auto max-w-sm border p-6 shadow-xl backdrop:bg-black/50"
      aria-label={title}
    >
      <h2 className="font-display text-lg tracking-tight">{title}</h2>
      <p className="text-graphite mt-2 text-sm leading-relaxed">{body}</p>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="border-line hover:border-ink border px-4 py-2 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="bg-red-700 px-4 py-2 text-sm text-white transition-colors hover:bg-red-800"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
