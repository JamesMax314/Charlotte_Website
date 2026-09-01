"use client";

import { useState } from "react";
import { RichTextEditor } from "./rich-text-editor";
import type { FontOption } from "@/lib/fonts";
import { serialiseDoc, type RichDoc } from "@/lib/rich-text";

/**
 * A page-copy field, inside a form that still saves behind a Save button.
 *
 * The document lives in React state and rides along in a hidden input, because
 * the surrounding sections are plain `<form action={…}>` and a contenteditable
 * submits nothing on its own. Keeping the form shape means this section saves
 * exactly like the others, and one Save still means one write.
 */
export function RichCopyField({
  name,
  label,
  initial,
  fonts,
}: {
  /** The rich column's name; the action derives the plain mirror from it. */
  name: string;
  label: string;
  initial: RichDoc;
  fonts: FontOption[];
}) {
  const [doc, setDoc] = useState(initial);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-graphite text-xs">{label}</span>
      <input type="hidden" name={name} value={serialiseDoc(doc)} />
      <RichTextEditor
        value={doc}
        onChange={setDoc}
        fonts={fonts}
        ariaLabel={label}
        minHeight="14rem"
        className="border-line max-w-none border p-3 leading-relaxed"
      />
    </div>
  );
}
