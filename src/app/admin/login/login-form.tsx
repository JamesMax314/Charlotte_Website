"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {} as { error?: string });

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-3">
      <label htmlFor="passphrase" className="text-graphite text-xs">
        Passphrase
      </label>
      <input
        id="passphrase"
        name="passphrase"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="border-line focus:border-ink w-full border bg-transparent px-4 py-3 font-mono text-sm outline-none"
      />

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-ink hover:bg-ink hover:text-paper mt-2 px-5 py-3 text-sm transition-colors disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
