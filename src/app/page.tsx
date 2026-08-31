export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-24">
      <p className="text-muted text-xs tracking-[0.2em] uppercase">Coming soon</p>

      <h1 className="font-display text-ink mt-6 text-5xl leading-[1.05] tracking-tight sm:text-6xl">
        Charlotte
      </h1>

      <p className="text-muted mt-6 max-w-md text-lg leading-relaxed text-balance">
        Original paintings and limited-edition prints. The new site is being built — work will be
        here shortly.
      </p>

      <hr className="border-line mt-12 border-t" />

      <p className="text-muted mt-6 text-sm">
        In the meantime, prints are available on{" "}
        <a
          className="text-accent underline decoration-1 underline-offset-4 hover:decoration-2"
          href="https://www.etsy.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Etsy
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
    </main>
  );
}
