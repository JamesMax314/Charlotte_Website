"use client";

import Image from "next/image";
import { useState } from "react";
import { Mark } from "@/components/mark";
import { setHeaderStyle } from "@/app/admin/settings-actions";
import { DEFAULT_SITE_NAME } from "@/lib/default-copy";
import {
  exceedsHeight,
  HEADER_DEFAULTS,
  HEADER_LIMITS,
  headerStyle,
  headerTokens,
  renderedHeight,
  type HeaderStyle,
} from "@/lib/header-style";
import { useAction } from "./use-action";

/**
 * The top bar's proportions, with a working miniature of the real thing.
 *
 * The preview is the point of this panel. Height and type size are the two
 * settings whose effect cannot be guessed from a number — 76 means nothing on
 * its own — and the bar is the one piece of chrome that sits against her work
 * on every page. So the same markup the site renders is drawn here, driven by
 * the same custom properties, and it moves as she drags.
 *
 * The tokens are set on the preview element rather than on `:root`, because
 * the studio must not repaint in her header settings. That is the same
 * reasoning as the typefaces: the site layout does not render on admin routes,
 * and the studio stays legible whatever she chooses.
 */

/** The links the header always carries, in its order. */
const FIXED_LINKS = ["About", "Contact", "Shop"];

function Slider({
  label,
  hint,
  value,
  min,
  max,
  unit = "px",
  onInput,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onInput: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-graphite flex items-baseline justify-between gap-3 text-xs">
        <span>{label}</span>
        <span className="text-ink tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      {/*
        A range fires `change` continuously while it is dragged, so the value
        is held locally and written once the artist lets go — the same reason
        the colour picker commits on blur. `keyUp` covers the arrow keys, which
        never produce a pointer event.
      */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onInput(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="accent-accent w-full"
      />
      {hint && <span className="text-graphite/80 text-[11px]">{hint}</span>}
    </label>
  );
}

export function HeaderStyleField({
  initial,
  siteName,
  faviconKey,
  pageLabels,
  displayFamily,
}: {
  initial: HeaderStyle;
  siteName: string;
  faviconKey: string | null;
  /** Her own pages, so the miniature shows the bar she actually has. */
  pageLabels: string[];
  /** Resolved here rather than inherited: the studio is not set in her faces. */
  displayFamily: string;
}) {
  const [style, setStyle] = useState(initial);
  const { run, pending, error } = useAction();

  const patch = (next: Partial<HeaderStyle>) =>
    setStyle((current) => headerStyle({ ...current, ...next }));

  const commit = () => {
    if (
      style.height === initial.height &&
      style.nameSize === initial.nameSize &&
      style.navSize === initial.navSize
    ) {
      return;
    }
    run(setHeaderStyle(style), "Saving the header");
  };

  const outgrown = exceedsHeight(style);

  return (
    <div className="flex flex-col gap-6">
      {/*
        The miniature. Deliberately the site's chrome and not the studio's —
        paper rather than the sunk grey — because the whole question it answers
        is "what will a visitor see".
      */}
      <div>
        <div className="text-graphite mb-2 flex items-baseline justify-between gap-3 text-xs">
          <span>How it will look on your site</span>
          <span aria-live="polite">{pending ? "Saving…" : ""}</span>
        </div>

        <div style={headerTokens(style)} className="border-line bg-paper overflow-x-auto border">
          {/*
            The same three-slot grid the real header uses, so the miniature
            answers the question honestly: her pages sit in the middle, the
            fixed links at the end. A preview laid out differently from the
            thing it previews is worse than no preview.
          */}
          <div className="border-line grid min-h-[var(--header-height)] min-w-[38rem] grid-cols-[1fr_auto_1fr] items-center gap-x-6 border-b px-5 py-2">
            <div className="flex items-center gap-3">
              {faviconKey ? (
                <span className="border-line block h-9 w-9 shrink-0 overflow-hidden rounded-full border">
                  {/* Same reasoning as the header: a mark skips the width ladder. */}
                  <Image
                    src={`/media/${faviconKey}`}
                    alt=""
                    width={72}
                    height={72}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </span>
              ) : (
                <Mark className="text-ink h-9 w-9 shrink-0" />
              )}
              <span
                style={{ fontFamily: displayFamily }}
                className="text-ink text-[length:var(--header-name-size)] leading-tight tracking-tight"
              >
                {siteName || DEFAULT_SITE_NAME}
              </span>
            </div>

            <ul className="text-graphite flex items-center gap-x-6 justify-self-center text-[length:var(--header-nav-size)]">
              <li>Illustration</li>
              {pageLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>

            <ul className="text-graphite flex items-center gap-6 justify-self-end text-[length:var(--header-nav-size)]">
              {FIXED_LINKS.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>

          {/* A little of the page beneath it, so the bar has something to sit against. */}
          <div className="px-5 py-6">
            <div className="bg-paper-sunk h-16 w-full" />
          </div>
        </div>

        <p className="text-graphite mt-2 text-xs">
          The bar is {renderedHeight(style)}px tall.{" "}
          {outgrown
            ? "Your name needs more room than the height you chose, so the bar has grown to fit it — raise the height, or use a smaller name."
            : "On a phone the links wrap underneath, and the bar grows to suit."}
        </p>
      </div>

      <div className="grid max-w-2xl gap-5 sm:grid-cols-3">
        <Slider
          label="Bar height"
          value={style.height}
          min={HEADER_LIMITS.height.min}
          max={HEADER_LIMITS.height.max}
          onInput={(height) => patch({ height })}
          onCommit={commit}
        />
        <Slider
          label="Your name"
          value={style.nameSize}
          min={HEADER_LIMITS.nameSize.min}
          max={HEADER_LIMITS.nameSize.max}
          onInput={(nameSize) => patch({ nameSize })}
          onCommit={commit}
        />
        <Slider
          label="The links"
          value={style.navSize}
          min={HEADER_LIMITS.navSize.min}
          max={HEADER_LIMITS.navSize.max}
          onInput={(navSize) => patch({ navSize })}
          onCommit={commit}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => {
            setStyle(HEADER_DEFAULTS);
            run(setHeaderStyle(HEADER_DEFAULTS), "Restoring the header");
          }}
          className="text-graphite hover:text-accent text-xs transition-colors"
        >
          Back to the original proportions
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
