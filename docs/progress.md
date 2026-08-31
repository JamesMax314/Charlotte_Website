# Progress

A skimmable snapshot of where the site is. Long-form history lives in `git log`.
The product specification is `docs/project-brief.md`.

---

## Current State

- **Phase 0 complete.** Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4,
  deploying to Cloudflare Workers via the OpenNext adapter. Verified building and serving
  locally under `wrangler dev`.
- Design tokens and a styled placeholder home page are in place. No real content yet.
- Quality gate wired: ESLint (zero warnings), Prettier, `tsc --noEmit`, Vitest, and
  `next build`, all run in CI on push and pull request.
- **Not yet built:** public catalogue, admin, uploads, Etsy listing links. No database or
  media bucket exists yet — those arrive in Phase 2.
- **Not yet deployed.** Requires a Cloudflare account, `wrangler login`, and the cache
  bucket. See _Deploying for the first time_ below.

---

## Recent Phase Reference

| Phase | Summary                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Scaffolded Next.js 16 + Tailwind v4 on Cloudflare Workers (OpenNext); design tokens, Prettier/ESLint/Vitest, GitHub Actions CI, placeholder home page |

---

## Architectural Invariants

Non-obvious decisions that the code alone does not explain.

- **`esbuild` is a direct devDependency on purpose.** `@opennextjs/cloudflare` imports it
  but does not declare it, and Vite 8 lists `esbuild ^0.27 || ^0.28` as an optional peer
  while OpenNext's core pins exactly `0.25.4`. With no overlapping range, npm nests
  esbuild where the OpenNext CLI cannot resolve it, and `opennextjs-cloudflare build`
  fails with `ERR_MODULE_NOT_FOUND`. The root dependency satisfies Vite's range and gives
  OpenNext something to resolve; its core keeps its own nested copy. Do not remove it as
  an unused dependency.

- **The site is light-only, with no dark theme.** Artwork is judged against a gallery
  wall, and a dark background changes how every image reads. This is a deliberate design
  constraint, not an omission — do not add `prefers-color-scheme` handling without
  discussing it.

- **There is no `tailwind.config.ts`.** Tailwind v4 is CSS-first: the `@theme` block in
  `src/app/globals.css` is the equivalent, and is the correct place for token edits.
  (CLAUDE.md's UI-tweak rule names both files; only `globals.css` exists.)

---

## Deploying for the first time

Not yet done. Requires a Cloudflare account and these one-off steps:

```bash
npx wrangler login
npx wrangler r2 bucket create charlotte-website-opennext-cache
npm run deploy
```

The bucket backs Next's incremental cache and must exist before the first deploy, or the
worker will fail to start. `npm run preview` builds and serves the worker locally without
needing an account.
