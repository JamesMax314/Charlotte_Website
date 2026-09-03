"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveSettingsForm, type SettingsFormState } from "@/app/admin/settings-actions";
import { SettingsSection } from "./settings-section";
import { PRIMARY_BUTTON } from "./styles";
import { useAction } from "./use-action";
import { useUndo } from "./undo-provider";

const INITIAL: SettingsFormState = { status: "idle", rejected: [] };

/** What one submission of this form carried. */
type Submission = Record<string, string>;

const sameSubmission = (a: Submission, b: Submission): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
};

/**
 * A settings section that saves behind a button.
 *
 * The wall's page settings save on change, because they are switches the
 * artist flips while looking at the thing they change — an unsaved toggle
 * would make the canvas lie about what visitors see. A text box has no live
 * surface beside it to lie, and saving as she types means either a debounce
 * (racing writes, and a lost final keystroke if she navigates away) or an
 * invisible save on blur she cannot confirm.
 *
 * The fields are uncontrolled, so a long piece of copy does not re-render the
 * page on every keystroke.
 */
export function SettingsForm({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsForm, INITIAL);
  const { track } = useAction();
  const { record } = useUndo();

  const formRef = useRef<HTMLFormElement>(null);
  /**
   * What this form last submitted — or, until it has, what it rendered with.
   *
   * The fields are uncontrolled, so by the time a submission is in flight the
   * DOM already holds the new values and the old ones exist nowhere else.
   */
  const savedRef = useRef<Submission | null>(null);

  /**
   * Remounts the fields, and is the only honest way to put them back.
   *
   * These inputs take their value from `defaultValue`, which React applies on
   * mount and never again — so a revalidation that brings back the restored
   * settings re-renders the section without changing a single field on screen.
   * Writing to the DOM nodes directly would fix the plain inputs and not the
   * copy fields, whose editor holds a document in state behind a hidden input;
   * a fresh mount is one mechanism that is right for both.
   *
   * Safe to do under the artist's hands because it cannot happen under them:
   * `swallowsUndo` gives the shortcut back to the browser whenever the caret
   * is in a field, so a remount here never interrupts typing.
   */
  const [generation, setGeneration] = useState(0);

  const snapshot = (): Submission => {
    const form = formRef.current;
    if (form === null) return {};
    const entries: Submission = {};
    for (const [name, value] of new FormData(form).entries()) {
      if (typeof value === "string") entries[name] = value;
    }
    return entries;
  };

  // The values as rendered, which are the values as saved.
  useEffect(() => {
    savedRef.current = snapshot();
    // Re-read after a remount, which is how a restored section becomes the
    // baseline for the next change.
  }, [generation]);

  const restore = async (values: Submission, what: string) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(values)) data.set(name, value);
    await track(saveSettingsForm(INITIAL, data), what);
    savedRef.current = values;
    /*
      After the await, not before: the action revalidates, and the re-rendered
      section is what the remount below has to pick up. Bumping first would
      re-apply the defaults the form already had.
    */
    setGeneration((current) => current + 1);
  };

  /**
   * Records the save that is about to happen.
   *
   * `onSubmit` rather than a wrapper around the action, because this needs the
   * fields as the artist left them and `useActionState` hands the action a
   * FormData it has already built. Both read the same DOM at the same moment.
   */
  const onSubmit = () => {
    const before = savedRef.current;
    const after = snapshot();
    savedRef.current = after;
    if (before === null || sameSubmission(before, after)) return;

    record({
      label: "the settings",
      undo: () => restore(before, "Undoing the settings"),
      redo: () => restore(after, "Redoing the settings"),
    });
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit}>
      <SettingsSection
        title={title}
        hint={hint}
        status={pending ? "Saving…" : state.status === "saved" ? "Saved" : ""}
      >
        <div key={generation} className="flex flex-col gap-4">
          {children}
        </div>

        {state.rejected.length > 0 && (
          <p role="alert" className="mt-4 text-xs text-red-700">
            {state.rejected.join(" and ")}{" "}
            {state.rejected.length === 1 ? "was not saved" : "were not saved"} — check for a typo.
            Web addresses need to start with https://
          </p>
        )}

        <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} mt-5`}>
          Save
        </button>
      </SettingsSection>
    </form>
  );
}
