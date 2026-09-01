/**
 * The shell every settings section sits in.
 *
 * Matches the page settings panel on the wall editor, so the two admin
 * surfaces read as one thing.
 */
export function SettingsSection({
  title,
  hint,
  status,
  children,
}: {
  title: string;
  hint?: string;
  /** Live region for the section's own save state. */
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line bg-paper-sunk/40 mb-10 border p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-lg tracking-tight">{title}</h2>
          {hint && <p className="text-graphite mt-1 text-xs">{hint}</p>}
        </div>
        <span className="text-graphite h-4 shrink-0 text-xs" aria-live="polite">
          {status}
        </span>
      </div>
      {children}
    </section>
  );
}
