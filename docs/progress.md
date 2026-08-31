# Progress

A skimmable snapshot of where the site is. Long-form history lives in `git log`.
The product specification is `docs/project-brief.md`.

---

## Current State

- **Phases 0, 1 and 2 complete.** Next.js 16 (App Router, Turbopack) + TypeScript +
  Tailwind v4, deployed as a Cloudflare Worker via the OpenNext adapter.
- **The public site is built:** home, work index, artwork detail with a lightbox, about,
  contact, privacy, 404, sitemap and robots.
- **The catalogue lives in D1.** Artworks, images, listings and site settings are real
  tables, read at request time. Artwork images live in a private R2 bucket, served only
  through `/media` on content-addressed keys, with a responsive width ladder written at
  upload.
- **The admin works.** Passphrase sign-in, artwork CRUD, multi-file upload with
  client-side downscaling, drag-to-arrange for the gallery and for an artwork's images,
  draft/publish/archive, and the Etsy listing editor.
- **Content is seeded, not final.** `pnpm seed` prefers real artwork in `tmp_art/`
  (gitignored) and falls back to generated placeholders in `public/seed/`. All copy is
  placeholder and asserts no client relationships.
- **Not yet built:** link-health cron, outbound click tracking, contact form delivery.
- **Not yet deployed.** Needs a Cloudflare account, two R2 buckets, a D1 database and two
  secrets. See _Deploying for the first time_ below.

---

## Recent Phase Reference

| Phase           | Summary                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0               | Scaffolded Next.js 16 + Tailwind v4 on Cloudflare Workers (OpenNext); pnpm, design tokens, Prettier/ESLint/Vitest, GitHub Actions CI                                                                                                                                 |
| 1               | Public catalogue on seeded data: home, work grid, artwork detail with `<dialog>` lightbox, static pages, sitemap/robots, `VisualArtwork` JSON-LD                                                                                                                     |
| 2               | Catalogue moved into D1 + R2; passphrase admin with upload, drag-to-arrange, publish/archive and the Etsy listing editor; custom image loader replacing the absent Workers image optimiser                                                                           |
| 3 (in progress) | Layout and styling on real artwork; home rebuilt as an editable free-form wall of pieces and text; page settings, snapping, fonts, right-click menus; streamlined image upload with a details dialog; per-piece pages built on the same wall; store moved to `/shop` |

---

## Architectural Invariants

Non-obvious decisions that the code alone does not explain.

- **`pnpm.packageExtensions` declares `esbuild` for `@opennextjs/cloudflare`.** The
  adapter imports esbuild without declaring it as a dependency. Under pnpm's isolated
  `node_modules` an undeclared import cannot resolve, so `opennextjs-cloudflare build`
  fails with `ERR_MODULE_NOT_FOUND`. The extension in `package.json` declares the missing
  dependency on the adapter's behalf. Remove it and the Cloudflare build breaks — the
  Next.js build will still pass, so CI catches this only at the `build` step.

- **`pnpm.onlyBuiltDependencies` is required, not optional.** pnpm 10 blocks dependency
  postinstall scripts by default. `esbuild`, `workerd` and `unrs-resolver` fetch native
  binaries in theirs, and silently produce a broken toolchain if the scripts are skipped.

- **The site is light-only, with no dark theme.** Artwork is judged against a gallery
  wall, and a dark background changes how every image reads. This is a deliberate design
  constraint, not an omission — do not add `prefers-color-scheme` handling without
  discussing it.

- **There is no image optimizer on Cloudflare Workers.** `/_next/image` returns 404 in
  the deployed Worker, and Cloudflare Images charges per transformation. Instead the
  browser renders a fixed width ladder at upload time, `src/image-loader.ts` addresses
  those objects by naming convention, and `/media` falls back to the base object when a
  derivative is missing. Removing the custom loader silently breaks every image in
  production while leaving `next dev` working — which is exactly how this was missed
  until the worker was actually exercised.

- **Every page is `force-dynamic`, and that is deliberate.** D1 is unreachable during
  `next build` (no binding outside the Worker), so nothing can be prerendered against
  real data. The root layout reads site settings, so this applies to every page, not just
  the catalogue. `getSiteSettings` degrades to defaults when the binding is absent so CI
  can still build. **Known debt:** this gives up the full-route cache entirely. Revisit
  with `"use cache"` once traffic justifies it.

- **The admin passphrase must stay machine-generated.** Auth uses a salted SHA-256, not
  PBKDF2 or Argon2, because the Workers free tier allows roughly 10ms CPU per request and
  a proper slow hash exceeds it. That trade is only sound because `pnpm admin:passphrase`
  generates ~120 bits of entropy. Never accept a human-chosen passphrase.

- **Server actions gate themselves.** Actions are routed independently of layouts, so the
  admin layout's session check protects pages only. Every action and route handler calls
  `requireSession()` / `hasValidSession()` itself. Removing one of those calls exposes it
  with no visible symptom.

- **Portfolio and store are separate collections.** `portfolio_items` drives the home
  page and has no price; `artworks` + `listings` are the store. They share the upload
  endpoint and the `ImageManager` component but nothing else. Do not merge them — the
  brief treats "shown" and "for sale" as different things.

- **`parent_id` is what scopes a wall.** NULL is the home page; an id is that piece's own
  page. Every read of `portfolio_items` or `wall_texts` must filter on it, or elements
  belonging to a piece's page leak onto the home wall. The same `PortfolioCanvas` and
  `PortfolioWall` render both, which is why a sub-page needed no new components.

- **Elements on a piece's page are inert, enforced in the domain not the UI.**
  `isInteractive` requires `clickable && parentId === null`, so a child can never link
  even if its row says clickable. Hiding the toggle in the dialog is convenience; this is
  the guarantee.

- **A blank title means no hover overlay.** `showsHoverName` also requires the page-wide
  setting and clickability. This is what lets decorative marks and icons sit on the wall
  without advertising themselves; a piece is made fully inert by turning clickable off.

- **Turning clickable off hides a piece's page, it does not delete it.** The page's
  elements stay in the database and `/work/<slug>` 404s, so switching it back on restores
  everything.

- **The add-image flow creates a draft row before the dialog opens**, because the image
  needs somewhere to attach. Cancelling deletes it again, which is the only thing standing
  between this flow and a database full of empty pieces — verified rather than assumed.

- **Never fire a server action with bare `void`.** It discards rejections, so a failed
  delete or save is indistinguishable from a successful one. The wall routes them through
  a helper that surfaces the error to the artist and the console.

- **A text box's font is an open string key, not a database enum.** The artist will be
  able to upload her own fonts, and an enum would force a schema migration for each one.
  `resolveFontFamily` in `src/lib/fonts.ts` maps the key to a complete CSS font stack and
  falls back to Inter when the key is unknown — the path a deleted uploaded font will
  take. The registry returns a family string rather than a variable name precisely so
  uploaded fonts can join without any consumer changing.

- **Two extension points widen when uploaded fonts arrive:** the `fonts` prop on
  `TextToolbar` (injected, not imported, for this reason) and the `isKnownFontId` guard
  in `updateWallText`.

- **Floating surfaces go through `FloatingLayer`.** It portals to `document.body`,
  keeps itself inside the window and closes on Escape or an outside click. Both the
  context menu and the text formatting panel use it, so the stacking and dismissal
  behaviour cannot drift apart.

- **The formatting panel follows the pointer; it is never a fixed bar.** Pinned above the
  canvas it was off-screen while editing a text box near the bottom of a tall wall, so
  the artist could not see what her own changes did.

- **The context menu is portalled to `document.body`.** Wall elements carry their own
  z-index, some in the thousands after the heading migration, and they share a stacking
  context with anything rendered beside them — so a menu left in the canvas tree painted
  _underneath_ the artwork no matter how high its z-index went, which reads as a
  transparent menu. A portal sidesteps stacking contexts entirely. Its background is set
  explicitly rather than inherited, since it sits over artwork.

- **Only the primary button starts a canvas gesture.** A right-click still fires
  `pointerdown`, so without the `event.button !== 0` guard it began a drag that never
  moved — and pointerup then read it as a tap and opened the editor behind the context
  menu.

- **Long-press stands in for right-click, and is not optional.** iPadOS has no
  right-click and the artist works on a tablet, so without the 500ms press the context
  menu — and therefore adding anything to the wall at all — would be unreachable on her
  main device. It cancels the moment a gesture becomes a drag, so pressing and moving
  still repositions a piece.

- **Destructive confirmation uses `<dialog>`, never `window.confirm`.** The platform
  supplies focus trapping, page inertness and Escape-to-close; a native confirm blocks
  the whole page and cannot carry the piece's name.

- **Text sizes are `cqw`, so the canvas must declare `container-type: inline-size`.**
  Type scales with the wall exactly as pieces do. The mobile stack clamps the same value,
  because raw `cqw` against a phone-width container renders body copy at about six pixels.

- **The largest text box is rendered as the page `<h1>`.** Replacing the fixed heading
  with free text boxes left the home page with no heading element at all, costing both
  search ranking and screen-reader navigation. `headingTextId` picks the largest non-empty
  text, ties going to whichever sits highest, so the artist gets correct markup without
  having to think about it.

- **Text boxes resize in both directions; pieces do not.** A piece's height follows its
  cover image so artwork cannot be distorted, but a text box has no aspect ratio to
  protect, which is why `snapResizeFree` exists alongside `snapResize`.

- **Known debt: the custom 404 never renders.** `src/app/(site)/not-found.tsx` — the
  "Walked off somewhere" page with the mirrored mark — is not picked up, so both unmatched
  URLs and `notFound()` from a site route fall through to Next's default "This page could
  not be found". It has been this way since the pages moved into the `(site)` route group.
  Fixing it means deciding whether the 404 should carry the site header and footer, which
  a root-level `app/not-found.tsx` would not get for free.

- **Known debt: the wall renders its contents twice**, once for the mobile stack and once
  for the desktop canvas, with CSS hiding one. That doubles the HTML and produces two
  `<h1>` elements in the source. Lazy loading spares the duplicate image requests for all
  but the priority image. Fixing it means one DOM tree switched by CSS custom properties
  and `order`, which is a worthwhile follow-up rather than a quick change.

- **Snap guides record which edge may reach them.** Without that, any edge could reach
  any guide: with a gap set, a piece's trailing edge still latched onto a neighbour's
  leading edge — flush, no gap — and competed with the gutter position, so pieces came to
  rest at a mixture of spacings on both axes. Alignment guides now accept only the
  matching edge (left to left, right to right), and abutting guides only the facing one.
  With no gutter the two collapse onto the same line, which restores flush contact.

- **The gutter is one distance, not two.** Both axes are percentages of canvas width, so a
  horizontal and a vertical gap are the same size on screen. Tests assert the two are
  equal rather than merely non-zero.

- **The gutter shifts snap targets; it does not forbid closeness.** With the gap on,
  pieces snap to sit a gutter apart rather than flush, while alignment guides (edge to
  edge, centre to centre) stay available so work can still be stacked in a column.
  Overlap remains possible on purpose. With the gap off the abutting guides collapse onto
  the neighbour's edges, which is the flush behaviour.

- **Page settings save on change, not behind a Save button.** They are switches the
  artist flips while looking at the wall; an unsaved change would make the editor lie
  about what visitors see.

- **Snap targets are computed once per gesture, not per frame.** The other pieces cannot
  move while one is being dragged, so `collectGuides` runs in `begin` and is carried on
  the drag ref. Snapping considers all six candidate edges of the moving piece — leading,
  centre and trailing on both axes — and takes the closest, which is why a piece
  sometimes aligns by an edge the artist was not consciously aiming with.

- **Resizing snaps in width-space.** Only width is adjustable, so a bottom-edge snap is
  solved back into a width via the aspect ratio rather than applied directly, and the two
  axes are compared on the same scale before choosing a winner.

- **The drag canvas attaches its pointer listeners synchronously, not in an effect.**
  An effect runs after the next render, so the opening moves of a gesture were dropped
  and dragging appeared completely dead. The listeners go on the window, because a quick
  drag outruns the tile and the pointer is usually released outside it.

- **Gesture state lives in a ref, never React state.** Reading `moved` from state made
  every drag race the render: pointerup saw a stale flag, concluded the gesture was a tap,
  and navigated to the edit page instead of moving the piece.

- **The editor canvas height derives from committed positions, never the live drag.**
  Deriving it from the drag grew the canvas as a piece was pulled downward, which shifted
  every other piece and fought the gesture.

- **The public wall and the editor canvas must clip identically.** Pieces may be dragged
  to overlap and to bleed past the edges; without matching `overflow-hidden` the site
  gains a horizontal scrollbar and stops matching what the artist arranged.

- **Portfolio layout is stored as percentages of canvas WIDTH — including `y`.** Using
  one axis for every unit is what lets the arrangement scale proportionally at any
  viewport width. Heights are never stored: they derive from each cover image's natural
  aspect ratio, so resizing cannot distort artwork.

- **The mobile stack order is derived, not stored.** `inReadingOrder` sorts by y then x,
  so the artist arranges once and never maintains a second ordering that can drift out of
  step with the wall.

- **`src/lib/portfolio.ts` must stay free of database imports.** The admin canvas is a
  client component and needs the layout maths, so pulling D1 in there breaks the build
  with a `server-only` error. Queries live in `portfolio-queries.ts`. The same split
  exists for `artworks.ts` / `catalogue.ts`.

- **An artwork can have no images, and every surface must cope.** The artist creates a
  piece, publishes it, and uploads photographs afterwards — so `images[0]` is routinely
  undefined on a live page. Use `primaryImage()` rather than indexing. This crashed
  `/work` in Phase 2 because `ArtworkCard` assumed an image existed.

- **Placeholder slugs follow the title; edited slugs do not.** New pieces are created as
  "Untitled", seeding slugs like `untitled-3`. `updateArtwork` regenerates the slug from
  the title while it still matches that pattern, so renaming a piece fixes its URL, but a
  slug the artist has deliberately typed is never overwritten.

- **Every `DndContext` needs an explicit `id`.** dnd-kit derives its
  `aria-describedby` target from a module-level counter that starts at zero on the server
  but has already advanced on the client, so omitting the id causes a hydration mismatch
  on every sortable item _and_ leaves the attribute pointing at an element that does not
  exist — screen-reader users get no drag instructions at all.

- **Reordering is one `CASE` statement, not a write per row.** The whole rearrange lands
  atomically in a single D1 round trip, so a dropped connection cannot leave the gallery
  half-reordered.

- **Archived and draft are different kinds of hidden.** Archived work is off the gallery
  but its URL still resolves, because a link shared two years ago must not 404. Drafts
  resolve to nothing at all. `getArtworkBySlug` encodes both rules and is covered by tests.

- **A cheap digital download must never set a card's "from" price.** Prints are the
  headline product; advertising "From £12" beside a £65 print is accurate and misleading
  at once. `headlinePricePence` prefers prints, and a test guards it.

- **There is no `tailwind.config.ts`.** Tailwind v4 is CSS-first: the `@theme` block in
  `src/app/globals.css` is the equivalent, and is the correct place for token edits.
  (CLAUDE.md's UI-tweak rule names both files; only `globals.css` exists.)

---

## Running it locally

One-time setup:

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then fill it from the next command
pnpm admin:passphrase            # prints the passphrase and both secret values
pnpm db:migrate:local            # creates the D1 tables
pnpm seed                        # loads eight placeholder artworks into D1 and R2
```

Then either:

```bash
pnpm dev       # fast iteration on http://localhost:3000
pnpm preview   # the real Worker on http://localhost:8787 — build first, slower
```

**Test in `preview` before believing anything.** `next dev` does not run the deployed
worker and will happily hide production-only failures. The missing image optimiser in
Phase 2 is the worked example: every image on the site was broken in the worker while
`next dev` looked perfect.

## Deploying for the first time

Not yet done. Requires a Cloudflare account and these one-off steps:

```bash
pnpm exec wrangler login

# Storage
pnpm exec wrangler r2 bucket create charlotte-website-opennext-cache
pnpm exec wrangler r2 bucket create charlotte-website-media

# Database — paste the returned uuid into wrangler.jsonc as database_id
pnpm exec wrangler d1 create charlotte-website
pnpm run db:migrate

# Secrets. Generate both with `pnpm admin:passphrase`, which prints the
# passphrase once — give that to the artist.
pnpm exec wrangler secret put ADMIN_PASSPHRASE_HASH
pnpm exec wrangler secret put SESSION_SECRET

pnpm run deploy
```

For local development instead: `cp .dev.vars.example .dev.vars`, fill it from
`pnpm admin:passphrase`, then `pnpm db:migrate:local && pnpm seed`.

Note `pnpm run deploy`, not `pnpm deploy` — the latter is a built-in pnpm command for
workspace deployment and will not run the script.

The bucket backs Next's incremental cache and must exist before the first deploy, or the
worker will fail to start. `pnpm preview` builds and serves the worker locally without
needing an account.
