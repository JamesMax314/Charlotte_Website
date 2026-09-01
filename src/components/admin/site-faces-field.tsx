"use client";

import { useState } from "react";
import { setSiteFaces } from "@/app/admin/settings-actions";
import { resolveRoleFamily, type FaceRole, type FontOption, type UploadedFont } from "@/lib/fonts";
import { useAction } from "./use-action";

const SELECT =
  "border-line focus:border-ink w-full max-w-xs border bg-transparent px-3 py-2 text-sm outline-none";

function FaceSelect({
  label,
  hint,
  role,
  value,
  fonts,
  onChange,
}: {
  label: string;
  hint: string;
  role: FaceRole;
  value: string;
  fonts: FontOption[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm">{label}</span>
      <span className="text-graphite text-xs">{hint}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Native rather than a custom dropdown, as on the wall's text toolbar:
        // reliable on a tablet and needs no dismissal handling.
        className={`${SELECT} mt-1`}
        style={{ fontFamily: resolveRoleFamily(value, role, fonts) }}
      >
        {fonts.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
            {font.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The two faces the public site is set in.
 *
 * Saves on change rather than behind the section's Save button: picking from a
 * select is a discrete commit, unlike the colour input which fires
 * continuously while its picker is dragged.
 *
 * The specimen below the selects is not decoration — it is the only preview
 * there is. The studio deliberately keeps Inter and Fraunces so it stays
 * legible whatever she picks, so unlike the highlight colour she cannot judge
 * this choice by looking at the page she is on. Per-option previews do not
 * cover it either: WebKit ignores `font-family` on an `<option>` in its native
 * popup, and she works on an iPad.
 */
export function SiteFacesField({
  bodyFontId,
  headingFontId,
  fonts,
  uploaded,
}: {
  bodyFontId: string;
  headingFontId: string;
  /** Built-ins plus her uploads, merged by the page. */
  fonts: FontOption[];
  /** The uploads alone, for the format warning. */
  uploaded: UploadedFont[];
}) {
  const [value, setValue] = useState({ bodyFontId, headingFontId });
  const { run, pending, error } = useAction();

  const apply = (patch: Partial<typeof value>, what: string) => {
    setValue({ ...value, ...patch });
    run(setSiteFaces(patch), what);
  };

  const display = resolveRoleFamily(value.headingFontId, "display", fonts);
  const body = resolveRoleFamily(value.bodyFontId, "body", fonts);

  /*
    A 2MB .ttf was tolerable as one wall's text. As the face every page is set
    in it is not, and .woff2 is roughly half the size for the same drawing.
  */
  const heavy = uploaded.filter(
    (font) => font.format !== "woff2" && [value.bodyFontId, value.headingFontId].includes(font.id),
  );

  return (
    <div
      // Previews locally through the very same custom properties the site uses,
      // so the specimen cannot drift from the thing it is previewing.
      style={{ ["--site-display" as string]: display, ["--site-body" as string]: body }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap gap-6">
        <FaceSelect
          label="Headings"
          hint="Page titles, your name in the header, and work titles."
          role="display"
          value={value.headingFontId}
          fonts={fonts}
          onChange={(id) => apply({ headingFontId: id }, "Saving the heading font")}
        />
        <FaceSelect
          label="Body text"
          hint="Everything else — your About and Privacy words."
          role="body"
          value={value.bodyFontId}
          fonts={fonts}
          onChange={(id) => apply({ bodyFontId: id }, "Saving the body font")}
        />
        <span className="text-graphite self-end pb-3 text-xs" aria-live="polite">
          {pending ? "Saving…" : ""}
        </span>
      </div>

      <div className="border-line bg-paper border p-5">
        {/*
          `font-display` deliberately, not an inline style: this heading is
          painted by the same rule the site's headings are, so the preview and
          the site cannot disagree.
        */}
        <p className="font-display text-3xl tracking-tight">About</p>
        <p
          style={{ fontFamily: "var(--site-body)" }}
          className="mt-3 max-w-prose text-sm leading-relaxed"
        >
          I am an illustrator working in collage, drawing and digital colour. Most of my work is
          commissioned: illustrated maps, interpretive panels and editorial spreads that have to be
          read as well as looked at.
        </p>
      </div>

      <p className="text-graphite max-w-prose text-xs">
        The studio stays in its own fonts so it is easy to work in whatever you choose. This panel
        is how your site will look.
      </p>

      {heavy.length > 0 && (
        <p className="text-graphite max-w-prose text-xs">
          <span aria-hidden="true">⚠ </span>
          {heavy.map((font) => `“${font.label}”`).join(" and ")}{" "}
          {heavy.length === 1 ? "is not" : "are not"} a .woff2. As one of your site&rsquo;s main
          fonts it loads on every page — converting it to .woff2 roughly halves what visitors have
          to download.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
