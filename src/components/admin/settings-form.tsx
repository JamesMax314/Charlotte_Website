"use client";

import { useActionState } from "react";
import { saveSettingsForm, type SettingsFormState } from "@/app/admin/settings-actions";
import { SettingsSection } from "./settings-section";
import { PRIMARY_BUTTON } from "./styles";

const INITIAL: SettingsFormState = { status: "idle", rejected: [] };

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

  return (
    <form action={formAction}>
      <SettingsSection
        title={title}
        hint={hint}
        status={pending ? "Saving…" : state.status === "saved" ? "Saved" : ""}
      >
        <div className="flex flex-col gap-4">{children}</div>

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
