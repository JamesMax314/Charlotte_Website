# Progress

A skimmable snapshot of where the site is. Long-form history lives in `git log`.
The product specification is `docs/project-brief.md`.

---

## Current State

- **Phases 0 to 3 complete.** Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind
  v4, running as a Cloudflare Worker via the OpenNext adapter.

- **The home page is a wall the artist composes herself.** Images and text boxes are
  placed, resized and layered freely; positions are percentages of canvas width so the
  arrangement scales with the viewport, and below `md` it gives way to a stack in reading
  order. Edges snap to one another with an optional gutter. The wall grows downward on
  its own: its height is read from the lowest element, and there is no way to add above
  the top — see Phase 17.

- **Text is rich text, everywhere she types it.** Wall boxes and the About,
  Contact and Privacy copy all take bold, italic, underline, colour, face, size, links and
  per-line alignment and line spacing within a single box, with the controls along the top
  of the box.
  Those controls are the whole of the formatting interface — a text box has nothing more
  behind a menu. It is stored as a document, not as HTML — see the invariants.

- **Pieces can have pages of their own**, built with the same wall editor. Elements placed
  on them are inert by construction and never link onward — but they are not inert to the
  eye: an image with nowhere to go opens full screen instead, in the shop's lightbox,
  cycling every zoomable image on that wall. It is on by default and switched off per
  image, which is how a decorative mark stays silent.

- **Work is arranged one piece at a time or several at once.** A rectangle dragged over
  the wall, or shift-clicking, gathers images and text into a selection that moves and
  scales as one body — type scaling with its box — and can be aligned, spaced evenly or
  deleted together. It is the same on every free-form wall: the home page, the artist's
  own pages, and a piece's page.

- **The artist adds her own pages**, linked from the middle of the top bar behind Home.
  Each is the same free-form wall as the home page — work placed on one is clickable and
  keeps a page of its own — and the studio's top bar is the whole interface for them: drag
  a link to move it, click it to edit the page, press + to add one.

- **Two separate collections.** The portfolio drives the home page and carries no prices;
  the store is `artworks` + `listings`, browsable at `/shop` and sold at `/shop/<slug>`.
  They share the upload endpoint and image pipeline and nothing else.

- **The shop is a catalogue, not a wall.** Uniform 3:4 tiles with a centre crop, in the
  artist's order — no search, no filters, and no client JavaScript on the index. A piece
  sells one thing: one product type in her own words, one Etsy link, one price.

- **Her mistakes are reversible while she is on the page.** Cmd+Z (Ctrl+Z on
  Windows and Linux) undoes anything the studio does — a drag, a group scale, a
  delete, a setting, an uploaded font — and Shift+Cmd+Z puts it back. The history
  belongs to the page and is forgotten on leaving it. In a text box the browser's
  own undo still has the key; the history takes over once she clicks away, where
  one editing session is one step.

- **Nothing reaches a visitor until the artist says so.** Her saves are immediate
  but private; "Make live" in the studio's top bar copies the whole public site — walls,
  pages, shop, settings, fonts — into one revision that visitors are then served. The
  button reads "Live" when the two are identical. Signed in, she is served her draft on
  the real site, marked with a small pill, so "View site" shows what she is about to
  publish.

- **Everything lives in D1 and R2.** Artwork is in a private bucket, served only through
  `/media` on content-addressed keys. The responsive width ladder is rendered at upload
  by Cloudflare's image service, in AVIF and WebP, and `/media` picks the encoding from
  the request's `Accept` header and caches the answer at the edge.

- **The admin.** Passphrase sign-in; a Home page editor with page settings — gap,
  snapping, an alignment grid, hover names and an optional content fade-in — plus right-click menus, an
  image details dialog and text formatting at the pointer; a per-piece page editor; and a
  store grid where a piece is added and edited in a dialog over the arrangement, with
  right-click for sold out, draft, archive and delete.

- **Content is real, copy is not.** `pnpm seed` prefers the artist's work in `tmp_art/`
  (gitignored) and falls back to generated placeholders. All wording is placeholder and
  asserts no client relationships.

- **A settings page the artist owns.** `/admin/settings` carries her name and mark, her
  Instagram and Etsy links, the top bar's height and type sizes and the space it leaves
  around her work — with a working miniature of it — the highlight colour, uploaded fonts,
  and the copy for the
  About and Privacy pages — with a photograph beside the About text, and the contact words
  and address that sit beneath it. The mark is
  both the circular badge in the header and the browser-tab icon, and she picks the body
  and heading typefaces the public site is set in.

- **The site describes itself to search engines.** Every page carries its own
  canonical, description, Open Graph block and Twitter card, and cannot render without
  an `<h1>`. Home and About declare who the artist is — `Person` and `WebSite`, with
  `sameAs` to her Instagram and Etsy — and the artwork pages refer to that entity by
  `@id`. She owns the description and the share image from settings.

- **Not yet built:** link-health cron, outbound click tracking, contact form delivery.
  The custom 404 does not render — see the invariants below.

- **Live at charlottewilkinsonart.co.uk.** DNS is cut over: the apex resolves to
  Cloudflare, the worker answers on it, and `robots.txt` allows indexing there while
  refusing every other origin the worker also answers on. Publishing changes still needs
  "Make live" — a settings change is not visible to a visitor until then.

- **Still the artist's to do, and no amount of code substitutes for it:** the About copy
  and wall text are all placeholder, image alt text is seeded from titles rather than
  written, and the site needs verifying in Google Search Console (a DNS TXT record on the
  zone Cloudflare already owns — no code, no deploy) with the sitemap submitted.

---

## Recent Phase Reference

| Phase | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Scaffolded Next.js 16 + Tailwind v4 on Cloudflare Workers (OpenNext); pnpm, design tokens, Prettier/ESLint/Vitest, GitHub Actions CI                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1     | Public catalogue on seeded data: home, work grid, artwork detail with `<dialog>` lightbox, static pages, sitemap/robots, `VisualArtwork` JSON-LD                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2     | Catalogue moved into D1 + R2; passphrase admin with upload, drag-to-arrange, publish/archive and the Etsy listing editor; custom image loader replacing the absent Workers image optimiser                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3     | Layout and styling on real artwork; home rebuilt as a free-form wall of images and text the artist composes; snapping with a gutter, page settings, fonts, right-click menus, in-place image details; per-piece pages on the same wall; store moved to `/shop`                                                                                                                                                                                                                                                                                                                                               |
| 4     | Optional content fade-in as the visitor scrolls, staggered from the top; plus the loading-priority and root hydration fixes it surfaced                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5     | The wall renders as one DOM tree rather than two, with CSS deciding the layout at the breakpoint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6     | Fixed the fade-in on mobile: one shared scroll sweep replacing the split timer/observer reveal, the opening pass moved off the bundle into the inline script, and image widths cut to the rung a phone can actually hold. The reloading that outlived it was Fast Refresh, not the site                                                                                                                                                                                                                                                                                                                      |
| 7     | Settings page: name, mark, links, highlight colour with a contrast guard, uploaded fonts, and the copy and photograph for the three static pages. Ownerless uploads, a runtime accent token, and the font list finally threaded through both walls                                                                                                                                                                                                                                                                                                                                                           |
| 8     | Body and heading typefaces chosen from the admin, driving the public site only. Runtime face tokens sit between the Tailwind theme and next/font, and uploaded faces are preloaded                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9     | The store reworked to docs/store.md: a `/shop` index; 3:4 cards; arrows on the product gallery; a free-text product type in place of the print/digital enum; and an admin grid whose add tile, dialog editor and right-click menu replace the separate artwork page and the multi-size listing editor                                                                                                                                                                                                                                                                                                        |
| 10    | Custom pages the artist adds herself, at the top level and linked from the centre of both top bars, composed on the home page's wall. A `WallScope` union replaces the bare `parentId` everywhere, so the three walls cannot be confused for one another                                                                                                                                                                                                                                                                                                                                                     |
| 11    | The top bar's height, its two type sizes and the space around the page moved into settings, driven by custom properties the site layout emits, with a live miniature of the real header beside the sliders. Vertical rhythm moved out of the pages and into the layout                                                                                                                                                                                                                                                                                                                                       |
| 12    | Rich text in every box the artist types into — marks, faces, sizes and links within one box — stored as a sanitised document and rendered as React elements rather than as HTML                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 13    | The artist's Instagram at the right end of the top bar, drawn as a line glyph and sized in `em` so it tracks her nav type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 14    | About and Contact merged into one page: the contact words, address and button sit beneath the about copy, edited in the same settings box, and `/contact` 308s to the heading                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 15    | The wall makes room at its top. An editor-only band above the page takes work dropped or dragged into it, and the arrangement moves down by the overhang so the new element becomes the top. Grow only — a matching shrink would make dragging the topmost element down lurch the whole wall                                                                                                                                                                                                                                                                                                                 |
| 16    | Draft and live are two different sites. The studio writes a draft; "Make live" copies the whole public site into one revision row that visitors are served. The badge compares a content hash, the signed-in artist previews the draft on the real site, and R2 deletes defer while the live site still needs the object                                                                                                                                                                                                                                                                                     |
| 17    | Reverted Phase 15. The editor's band above the wall is gone and elements clamp to zero again — dropping or dragging above the top no longer pushes the arrangement down. `WALL_HEADROOM` is kept; it named a number the wall already had                                                                                                                                                                                                                                                                                                                                                                     |
| 18    | The real domain, charlottewilkinsonart.co.uk, is the committed default for canonicals, the sitemap and OG cards, and `robots.txt` allows indexing only on that host — so the workers.dev origin the site answers on is never indexed alongside it                                                                                                                                                                                                                                                                                                                                                            |
| 19    | Deployed to Cloudflare on the artist's own account: two R2 buckets, a D1 database in WEUR, all migrations, both secrets, and the apex bound as a custom domain in `wrangler.jsonc`. Guarded reads now rethrow Next's control-flow errors, which the session check had started swallowing                                                                                                                                                                                                                                                                                                                     |
| 20    | Wall text sizes are typed in points. Storage stays `cqw` so type still scales with the wall; `cqwToPt` converts at the edge against a documented reference width, and the studio, the derived pt bounds and the server clamp now share one pair of limits. The run-level Small/Normal/Large dropdown is a points input too, converted against the box it sits in                                                                                                                                                                                                                                             |
| 21    | CI generates `cloudflare-env.d.ts` before it typechecks. The Worker's bindings live only in that generated file, so `env.DB` and `env.MEDIA` were TS2339 on every run while a developer machine stayed clean                                                                                                                                                                                                                                                                                                                                                                                                 |
| 22    | Search and sharing. Canonicals, Open Graph and Twitter cards on every page; `Person`/`WebSite` entity markup with `sameAs`; breadcrumbs; a heading fallback so no page renders without an `<h1>`; an artist-owned description and share image; `lastModified` in the sitemap                                                                                                                                                                                                                                                                                                                                 |
| 23    | Type sizes are chosen from a list, not typed into a spinner. One scrolling list of point sizes serves both the box and the run, and a span's size style is rebased against what it nests inside so the editor finally paints the size it reports                                                                                                                                                                                                                                                                                                                                                             |
| 24    | Alignment moved into the text box's own format bar, where it aligns the paragraph the caret is in rather than the whole box — so the settings copy fields get it too. The right-click menu's "Edit format" panel is gone, and with it every box-wide font, size, mark and colour it carried                                                                                                                                                                                                                                                                                                                  |
| 25    | A mark now replaces the marks of its own kind inside the selection, so a colour applied over coloured text takes; and "Clear" strips the data attributes `removeFormat` leaves behind, so it no longer clears the screen while publishing the old marks                                                                                                                                                                                                                                                                                                                                                      |
| 26    | The size list scrolls itself to the size in force instead of asking the browser to, so opening it in the settings form no longer scrolls the page under the artist                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 27    | An image with nowhere to go opens full screen. Every unclickable piece on every wall is zoomable by default, in the shop's own lightbox — now one shared component — and cycles the whole wall in reading order. A new per-image toggle turns it off for a decorative mark                                                                                                                                                                                                                                                                                                                                   |
| 28    | Clicking beside the enlarged picture closes it — the dialog fills the viewport, so the grey a visitor takes for the backdrop is inside it. The lightbox image is eager too: `w-auto` before load is 0px, and a zero-sized element never intersects, so lazy never fired                                                                                                                                                                                                                                                                                                                                      |
| 29    | Multi-select on every free-form wall: a marquee or shift-click gathers images and text, and the group moves, scales — carrying its type — aligns, spaces evenly and deletes as one. Layout saves for a selection land in a single `db.batch`. The artist works at a desktop, not an iPad, which is what settled the gesture                                                                                                                                                                                                                                                                                  |
| 31    | Deleting a piece works again. `parent_id` never had the `ON DELETE CASCADE` its schema declares, so deleting any of the 13 pieces that owned a page of their own raised a foreign-key error the artist saw only as React #441. D1 cannot be given the clause, so the cascade moved into the application — in the piece, selection and page deletes alike                                                                                                                                                                                                                                                     |
| 30    | An alignment grid over every free-form wall, switched on in page settings and spaced in columns across the width. Its lines are snap targets in their own right, merged with the edge guides so the nearer of the two wins. Editor only — no visitor ever sees it. Drawn as two repeating gradients and three heavier columns — five elements at any spacing. One element per line, first as dashed borders and then as gradients, put twenty-five full-height fills in every raster tile and made scrolling the editor crawl                                                                                |
| 33    | Line spacing, chosen in points from the same scrolling ladder the type size uses and applied to the paragraph the caret is in, exactly as the alignment buttons beside it are. Stored as a multiple of the box so it still scales with the wall, and written as an `em` on the block so one paragraph gets one spacing whatever sizes are mixed into it                                                                                                                                                                                                                                                      |
| 34    | Archive, on the home page and the artist's own custom pages. "Archive image" (or "Archive N images" on a selection) puts a piece away without deleting it — its own page and photographs untouched — and "Add from archive" restores it at the cursor, on any wall, from a shared box of thumbnails with delete-forever on right-click. Not offered on a piece's own page, which has nothing of its own to put away                                                                                                                                                                                          |
| 32    | Performance. The 1102 the artist met in the studio was one server action per keystroke, each revalidating the layout, each layout render hashing the whole site: writes are now queued and coalesced, autosaves no longer revalidate, and the publish hash moved behind its own endpoint. Images are downscaled server-side by the IMAGES binding into AVIF and WebP, `/media` negotiates on `Accept` and caches at the edge, and the LQIP that had been stored since Phase 2 is finally rendered. A follow-up taught `derivativeKeys` about the new encodings, which a delete would otherwise have orphaned |
| 36    | The top bar on a phone: the mark and the artist's name centred on their own line, with the menu button and Instagram at either end of the line below. The pages, the shop and About drop from the button as one list in reading order, in the flow so the page moves down rather than being covered. Built as a native `<details>` after the first version — a button with an `onClick` — was found on a phone as a hamburger that could be seen and not pressed. Desktop is untouched                                                                                                                       |
| 35    | Fixed "View site": it used `<Link>`, so leaving the admin was a client-side transition into a layout whose inline fade-in `<script>` never gets a parse pass — React refused to render it. Swapped for a plain `<a>` to force a full navigation. `/admin` now redirects to the wall (`/admin/portfolio`) instead of opening the shop grid, which moved to `/admin/shop`                                                                                                                                                                                                                                      |
| 37    | Undo and redo across the studio, on Cmd+Z and Ctrl+Z, with the history scoped to the page the artist is on and cleared the moment she leaves it. Inside a text box the browser's own character-level undo still wins; the history takes over once she puts the box down, when one editing session is one step. Every delete now reads its rows before removing them and hands them back, and `releaseMedia` stopped deleting from R2 altogether — bytes destroyed on the way out cannot come back                                                                                                            |

---

## Architectural Invariants

Non-obvious decisions that the code alone does not explain.

- **`revalidatePath` is the only thing that makes a server action re-render the
  page.** Next's action handler sets `skipPageRendering` from
  `workStore.pathWasRevalidated` and nothing else, so an action that revalidates
  nothing returns its result and no RSC tree at all. That is why the wall's
  autosaves — `updateWallText`, `savePortfolioLayout`, `saveWallTextLayout`,
  `saveWallLayouts` — deliberately do not call it: they write back values the
  canvas has already applied optimistically, so the render was a full trip
  through both layouts and the wall to be told what the browser was showing.
  Nothing goes stale, because `force-dynamic` leaves no route cache and Next's
  `staleTimes.dynamic` defaults to 0. A write that creates or removes a row
  still refreshes; the canvas cannot invent an id. Adding `refresh()` back to an
  autosave restores the cost with no symptom to notice it by.

- **The undo history is a stack of closures, not a log of changes.** The admin
  has no single shape for "an action" — a drag is a layout patch, a delete is a
  set of rows to put back, a settings toggle is one column — so a common
  representation would mean every surface encoding into it and the stack
  decoding again. `src/lib/undo-stack.ts` holds pairs of thunks recorded where
  the action is fired, beside the code they mirror. Three of its behaviours are
  load-bearing and none is visible from a call site: applications are
  **serialised**, because two quick presses are two writes and concurrent
  updates to one row let the earlier land second — the ordering fault
  `write-queue.ts` exists for; `record` is **suppressed while applying**,
  because an entry's undo goes back through the same path the artist's gesture
  takes and that path records, so without it the stack grows as it is consumed;
  and a failure **clears the whole history**, because every entry beneath the
  failed one was recorded against a state the site is no longer in. Dropping
  only the failed entry leaves a history that will do something confident and
  wrong.

- **The shortcut belongs to the browser whenever the caret is in a field.**
  Inside a text box, an input or a textarea, Cmd+Z is character-level undo, and
  taking it would mean reimplementing that inside a contenteditable — owning
  caret restoration through every render, which is the work `RichTextEditor`
  was written to avoid. So `swallowsUndo` yields there, and the history takes
  over once focus has left, where one editing session is one step. It yields
  inside an open `<dialog>` too, for a different reason: a modal traps focus, so
  anything the history could reverse is behind it and out of sight — and the
  studio's undo is silent by decision, so the press would look like nothing at
  all. Several surfaces depend on that second rule rather than merely benefiting
  from it. `SettingsForm` remounts its fields on undo and the piece dialog
  records only after its write has succeeded; both are safe precisely because
  the shortcut cannot fire while a modal is open or a field has the caret.

- **`releaseMedia` deletes nothing, and that is the price of undoable deletes.**
  It used to remove an object immediately unless the published revision still
  referenced it. Bytes destroyed on the way out cannot come back, so an undo
  would restore the row and leave a piece on the wall with a broken image —
  total, silent, and visible only once the artist looked. There is no useful
  test for "she might press Cmd+Z", so the distinction went and everything is
  queued. Nothing leaks: `sweepPendingDeletions` runs on every publish and
  reaches the same answer the function used to compute, taken later, once undo
  can no longer change it. The cost is a bucket holding deleted objects until
  the next "Make live" — which is the moment she decides what the site contains
  anyway. `discardAsset` in settings-actions.ts also **claims** the key it is
  given, because setting an asset back to the key it had is a write with no
  upload behind it and nothing else would drain the queue.

- **A delete's rows survive in the browser, not in the database.** Deletes
  return what they removed and the undo entry hands it back; there is no
  tombstone column and no deleted-at, because the history lives only while the
  artist is on one page and a durable record would outlive what it describes by
  years. The consequence is that the way back in is a public endpoint carrying
  rows a browser could have written, which is what `src/lib/undo-backup.ts` is
  for. Its per-column coercion is **generated from the Drizzle table**, so a
  column added to `src/db/schema.ts` is understood on the same commit and there
  is no second list to forget. A required column with no value is refused rather
  than dropped: dropping it takes the schema default instead, so a piece could
  come back published when it was a draft with nothing anywhere reporting it.

- **Restore order satisfies the foreign keys, and `parentsFirst` is the case
  the order cannot express.** `db.batch` runs in a transaction and SQLite checks
  a foreign key as each row lands, so a child inserted before its parent fails
  the whole restore. `RESTORE_ORDER` handles the table-to-table cases;
  `portfolio_items.parent_id` points into its own table, which no table ordering
  can solve. This is the same missing-cascade family as Phase 31 seen from the
  other side.

- **A creation and a deletion are the same mechanism run in opposite
  directions.** Undoing a creation deletes and keeps the backup; redoing it
  restores that backup — the same row with the same id — so a piece keeps its
  photographs and its own page across any number of presses. It is why
  `createWallText` and `addSiteFont` return their generated ids: the browser
  cannot invent one, and undo has to name what it removes.

- **Redo re-runs a delete and throws its new backup away.** This looks careless
  and is not: undo restored the captured rows exactly, ids included, so what a
  redo removes is the set the first backup already describes. Recapturing would
  be suppressed by the re-entrancy guard anyway.

- **Archiving carries each piece's previous status, and undo restores it.**
  `archivePortfolioItems` overwrites the column, so a draft put away and brought
  back would return _published_ — work on the live site the artist never chose
  to publish, from a keypress that claimed only to undo. `unarchivePortfolioItems`
  exists rather than a loop over `restorePortfolioItem` because that one places a
  piece at the pointer, which is right for the archive popup and wrong for an
  undo: archiving never touched x, y or z, so the position is still in the row.

- **The wall's undo is one currency: a placement.** A drag, a resize, a group
  move, a group scale, an align and a distribute differ in how the new positions
  are worked out and not at all in what has to be written to reverse them, so one
  before-and-after pair of lists undoes all six. `saveWallLayouts` gained an
  optional `z` for it — a drag brings its element to the front, so undoing one
  must put the layering back or a piece merely nudged stays in front of
  everything it used to sit behind, where no further undo can reach it. The `z`
  is optional and not defaulted, because a group move changes no layering and
  writing one there would flatten the stack the artist built.

- **An uncontrolled form can only be put back by remounting it.**
  `defaultValue` is applied on mount and never again, so the revalidation that
  brings back restored settings re-renders `SettingsForm` without changing a
  field on screen. Writing to the DOM nodes would fix the plain inputs and not
  the copy fields, whose editor holds a document in React state behind a hidden
  input — so the section bumps a `key` instead, after the write, and one
  mechanism is right for both. The snapshot it restores has to be kept per
  section, because by the time a submission is in flight the DOM already holds
  the new values and the old ones exist nowhere else.

- **Nothing expensive may sit on the admin layout's render path.** It re-renders
  on every mutation that revalidates, which is the multiplier that turned
  `getPublishState` — nine queries, a canonical serialisation of the entire site
  and a SHA-256 — into a whole-site read per keystroke, and then into
  `1102 Worker exceeded resource limit`. The publish state is still a content
  hash and still never a dirty flag; it is fetched by `PublishButton` from
  `/api/admin/publish-state`, so it costs its own invocation with its own CPU
  budget. The same rule sent `DraftMarker`'s half into `DraftPill`. The free
  tier allows roughly 10ms of CPU per request: a layout is the wrong place to
  spend it, however correct the answer.

- **An editor that emits on `input` must not write on `input`.** The rich text
  editor fires `onChange` per keystroke _and_ unconditionally on blur, so the
  canvas queues rather than sends: `src/lib/write-queue.ts` coalesces a burst
  into one patch, holds at most one write per row in flight, and `patchText`
  compares the document before queueing at all. The ordering guarantee is not
  decoration — concurrent updates to one row let the earlier land second and
  revert the artist's last keystrokes. The `maxDelay` ceiling is not decoration
  either: a trailing debounce alone never fires while typing continues.

- **R2's `put` refuses a body of unknown length, which is exactly what the
  IMAGES binding returns.** "Provided readable stream must have a known length"
  arrives asynchronously, inside `waitUntil`, so an upload still succeeds and a
  visitor still gets an image through `/media`'s fallback — while no derivative
  is ever written and every request regenerates the same rung. Nothing looks
  broken; the site is simply never optimised again. `render` in
  `image-ladder.ts` returns bytes rather than a stream for this reason, and a
  derivative is small enough that holding one is cheap.

- **A `.avif` object may hold WebP bytes, and that is not a fault to correct.**
  Cloudflare's image service has a size and time ceiling on AVIF encoding and
  silently returns WebP above it — on the live site the 400px rung comes back
  as AVIF while 1600 and 2400 come back as WebP. Nothing serves wrongly,
  because `/media` sends the object's own stored `contentType` and the browser
  gets WebP labelled WebP. The extension on the key is a _negotiation slot_ —
  "the best encoding for a browser that accepts AVIF" — and not a claim about
  the bytes. Renaming the object after what actually came back is the obvious
  correction and it is a trap: an AVIF-capable browser would then miss the slot
  it looks in, re-transform on every single request, and turn a bounded
  once-per-rung cost into a per-request one.

- **`derivativeKeys` is the only list a delete consults, so every encoding must
  be in it.** This has leaked twice. First the deletes removed the base object
  alone and left the width rungs in the bucket; then AVIF and WebP arrived and
  the function still named only the original extension, so the encodings that
  make up most of the bucket were the ones never swept. Both are silent —
  nothing reads an orphan, nothing logs one, and the only symptom is the
  storage bill. It over-names on purpose: R2 ignores a key that is not there,
  so naming a format that was never written costs nothing while omitting one
  leaks for good. Add a format to `MODERN_FORMATS` and `storage.test.ts` fails
  until the deletes know about it.

- **The negotiated format goes in the cache key, never into `Vary`.**
  Cloudflare's edge cache honours `Vary` on nothing but `Accept-Encoding`, so
  one entry for `-800.jpg` would be handed to every later visitor whatever their
  browser can decode — AVIF bytes under a `.jpg` URL, which renders as a broken
  image. It is invisible in testing because any machine testing it accepts AVIF.
  `cacheKeyFor` appends `?fmt=`; the `Vary: Accept` header is still sent, for
  the browser and proxy caches that do respect it.

- **`caches` does not exist while Next collects page data.** That pass runs in
  plain Node, outside any request, so reading `caches.default` at module scope
  is a `ReferenceError` that fails the build with "Failed to collect
  configuration for /media/[...key]" and no mention of caching. It is read
  inside the handler, and returns null rather than throwing so the route still
  serves images where no cache exists.

- **Cloudflare Images is affordable here because it runs once per image, not
  once per request.** The old comment in `image-loader.ts` ruled it out for
  costing "money per transformation", which is true only of transforming on the
  way out. The ladder is rendered at upload and stored in R2, so a fifty-piece
  catalogue is a few hundred transformations in its lifetime against a free
  allowance of thousands a month — and the work happens in the image service
  rather than in the Worker's own 10ms of CPU. `/media` generating a missing
  rung on first request obeys the same rule: it writes the result back, so it
  happens once.

- **A wall tile's `sizes` is its own width above `md` and a flat figure below
  it.** The two halves have opposite reasoning and neither generalises to the
  other. Above the breakpoint the arrangement exists and is stored in
  percentages of canvas width, so quoting the real number stops a small piece
  fetching a rung four times what it paints and stops a wide one being served
  something too small to be sharp. Below it there is no arrangement — the wall
  is a stack — and the figure is deliberately _under_ the slot, for the decode
  memory reason recorded further down. Do not unify them.

- **A canonical URL belongs in the root layout, and only as `"./"`.** Next's
  `mergeMetadata` clones the parent's resolved metadata and overwrites only the keys a
  page actually declares, so an absolute canonical there is inherited verbatim by every
  page that sets none — stamping the home page's address on `/about` and `/privacy` and
  telling Google they are duplicates of it. A `./` is resolved against the request's own
  pathname instead, and `/` comes out as the bare origin, matching the sitemap. Verified
  against the worker, not assumed.

- **`openGraph` and `twitter` are replaced wholesale, never merged.** Same rule from the
  other side: a page that declares two keys of an `openGraph` block loses the site name,
  the locale, the type and the image the layout supplied. That is why `siteOpenGraph` and
  `siteTwitter` exist and why every route builds the whole object through them — declaring
  one inline is a card that silently degrades on the pages most worth sharing.

- **A snapshot row that predates a column reads as the column's default, not as false.**
  `zoomable` was added after the site had been published, so every item row in the live
  revision simply has no such field — and `row.zoomable` is typed `boolean`, so nothing
  complains when `undefined` arrives and is read as "off". The symptom would have been
  every image on the live site going inert until the artist next pressed "Make live", from
  a deploy that changed no content. `shape()` applies `?? true` because that is what D1
  itself returns for a row written before the column existed. The same care is owed to the
  next nullable-by-omission column: `SNAPSHOT_VERSION` is the alternative and it is the
  wrong tool, because bumping it blanks the live site until a republish.

- **`snapshotMediaKeys` must name every image column in settings.** A key it omits is one
  `publishSite`'s sweep treats as unreferenced, so the object is deleted the first time the
  artist publishes after uploading it — and the breakage surfaces days later with nothing
  in any log. `shareImageKey` is listed there and has a test that says why.

- **There is no `<meta name="keywords">`, and that is deliberate.** Google has ignored it
  since 2009 and Bing reads it as a spam signal. The artist asked for one; the terms are
  placed where they work instead — `alternateName` for her name variants, `knowsAbout` for
  the subjects, and the title and description defaults for the disciplines. Do not add the
  tag back to look responsive to the request.

- **JSON-LD is escaped before it reaches a `<script>`.** The body of a script element is
  not parsed for entities but is scanned for `</script`, and `JSON.stringify` does nothing
  to `<` — so a piece the artist titled `</script><img onerror=…>` ended the element and
  had the rest parsed as markup. `jsonLdScriptContent` escapes `<` to `\u003c`: valid JSON,
  parses back to the same string, cannot close a tag.

- **The sitemap's `lastModified` is the publish time, one date for every URL.** Publishing
  writes the whole public site as a single revision, so a per-URL date is not a thing this
  site knows — and a snapshot strips `updatedAt` deliberately, so there is nothing else to
  read. Omitted entirely before the first publish, because then the draft is being served.
  Never `new Date()`, which would claim the whole site changed on every crawl.

- **A catch-all around a read must call `unstable_rethrow` first.** Next signals
  "this route cannot be static" by _throwing_ `DYNAMIC_SERVER_USAGE` out of `cookies()`,
  so the moment `getSiteSource` began consulting the session, every guarded read on the
  root layout's path started catching that signal and returning its fallback instead.
  The build did not fail: `/contact` and `/_not-found` were emitted as static pages with
  the _default_ site name, accent and typefaces baked in, and would have served those
  forever. Only the log line gave it away, and it read like a database problem. The
  guards in `getSiteSettings`, `getSiteFonts`, `getNavPages` and `getPublishedRevision`
  still degrade gracefully for real failures — they just let the framework's own errors
  through first.

- **Publishing is a snapshot, not a flag per row.** "Make live" serialises everything
  the public site reads into one `site_revisions` row, and visitors are served that row.
  A published flag on each table would make publishing a write per row, so a dropped
  connection halfway through would leave the site showing half of one version and half of
  another — and the artist asked for this precisely so a set of related changes goes out
  together. The cost is D1's 2MB row limit as a ceiling on the whole public site, which
  `publishSite` checks rather than discovers: the raw D1 error names no cause.

- **No revision means the site serves the draft.** Before the button has ever been
  pressed there is nothing to serve, and an empty site would be a worse answer than the
  one the artist last saved. It is also what makes this migration invisible on a database
  that has not been published yet — including local development, where `pnpm seed` never
  publishes. The same branch catches an unreadable revision, which is why
  `parseSnapshot` returns null instead of throwing.

- **The "Live" badge compares a content hash, never a dirty flag.** A flag has to be set
  by every write — four action modules and two route handlers — and the failure when one
  is forgotten is a badge that tells the artist her site is live when it is not. A hash
  cannot drift out of step with the content because it is the content. It is why
  `buildDraftSnapshot` orders every list down to `id`: a sort with ties would hash
  differently each time D1 returned the rows the other way round, and the badge would
  flicker at random.

- **Timestamps are stripped on the way into a snapshot.** Nothing public reads
  `created_at` or `updated_at`, and keeping them would put a value that changes on every
  save into the hash — so the badge would report unpublished changes after a save that
  altered nothing a visitor can see. They also do not survive the round trip: a
  `timestamp_ms` column gives a Date going in and a string coming back.

- **A snapshot over-includes on purpose; only drafts are filtered at build time.** Draft
  artworks and draft portfolio items can reach no public surface, so they are left out.
  Everything else — archived artworks, draft custom pages, wall text on a wall nobody can
  reach — goes in and is filtered on the way out by the same rules the D1 path applies.
  Over-including costs a few kilobytes in a row that is never served raw; under-including
  silently removes content from the live site, and the cases are subtle. A piece on a
  _draft_ custom page still answers at its own URL, so its page's elements are reachable
  even though the wall it sits on is not — which a "publishable content only" build would
  have quietly dropped.

- **The signed-in artist is served her draft on the public site.** "View site" has to
  show what she is about to publish, and the wall editor previews only the walls —
  nothing else previews the header height, the typefaces or the About copy. The marker
  that says so is fixed and out of the flow: a banner along the top would push the page
  down and change the spacing above the header, so she would be checking a layout no
  visitor will ever see.

- **Deleting an image no longer deletes it from R2 straight away.** The published
  revision can still reference the object, so an immediate delete knocks holes in live
  pages the artist has not touched. `releaseMedia` records those keys instead and
  `publishSite` sweeps them once the new revision no longer wants them. A key that is
  still referenced stays pending, because keys are content-addressed and the same bytes
  can be shared by two pieces — "she deleted the piece that uploaded it" does not mean the
  object is unused. It is also where the width-ladder derivatives finally get cleaned up;
  the portfolio and artwork deletes had only ever removed the base object.
  The queue has two sides: `releaseMedia` puts a key in, and `claimMedia` takes it out
  again when an upload writes that key. Without the second, a deleted-then-re-uploaded
  image sat in the queue permanently — content-addressed keys mean the same file
  returns the same key, and the sweep then refuses to remove it precisely because the
  new revision references it again. Nothing was ever wrongly deleted; the queue simply
  never drained, and a stale row reads as an asset that cannot be deleted.

- **`getDb` lives in `src/lib/db.ts`, not in `catalogue.ts`.** The publish layer needs
  the database, `catalogue` reads through `getSiteSource`, and `getSiteSource` lives in
  the publish layer — a cycle that would only resolve by accident of module evaluation
  order. A leaf module breaks it outright. Do not move it back.

- **`--site-body` and `--site-display` exist because `@theme inline` substitutes a theme
  key's _value_ into the utility.** `.font-display` compiles to
  `font-family: var(--font-fraunces)` and `--font-display` is never emitted at all, so
  overriding it at runtime does nothing — while `--font-sans` would appear to work,
  through the single `body{}` reference. Half a feature, failing quietly. The theme keys
  now point at two tokens the site layout can actually override. Do **not** shortcut this
  by reassigning `--font-inter` or `--font-fraunces`: the wall's text boxes resolve `sans`
  and `serif` through those same variables, so every box that chose one would change with
  the site. Verify against the built bundle, never the source — it is the only ground
  truth here.

- **Those tokens' defaults in `globals.css` are what the admin runs on.** The site layout
  does not render on admin routes, so nothing overrides them and the studio stays in Inter
  and Fraunces whatever the artist picks. They are not dead values, and the typeface
  settings deliberately do not repaint the admin — unlike the highlight colour, because a
  decorative body face would make the tool itself hard to use.

- **The site layout's `<style>` must never carry a `precedence` prop.** React would hoist
  it into the head, dedupe it, and then not remove it on unmount, so returning to the
  studio would leave it painted in her faces. Without it the element's lifetime is the
  layout's lifetime and the tokens revert cleanly.

- **An uploaded face is preloaded with a rendered `<link>`, not `ReactDOM.preload`.** That
  helper is called while the nested site layout renders, after the shell has flushed, so
  React can only record it as a hint in the flight stream — the browser then learns about
  the font from the bundle rather than from the parser, which is the whole point of the
  preload. It matters because an upload gets none of what next/font gives the Google
  families: no head stylesheet, no preload, no metric-matched fallback, and its
  `@font-face` sits in an inline `<style>` the preload scanner never sees.

- **The root layout reads D1 now, and `getSiteSettings` must keep its try/catch.** It
  needs the site name, the mark, the highlight colour and the uploaded fonts, so every
  page depends on that read — `/admin/login` included, which is why the catch is what
  keeps sign-in reachable when the database is broken. It is also why a missed migration
  is invisible: the catch swallows `no such column`, and the site renders perfectly at
  every default while silently ignoring the artist's settings. The `console.error` inside
  it is the only signal there is. The read costs no extra query because the function is
  memoised with `cache()`; before that the home page ran it three times.

- **The accent's foreground is derived, so every `bg-accent` button also needs
  `hover:text-paper`.** `--accent-ink` is whichever of paper or ink contrasts better with
  the artist's highlight, which is what makes an unreadable button unreachable. But all
  those buttons switch to `hover:bg-ink`, so with a light highlight the derived
  foreground _is_ ink — and without the override the label vanishes exactly when the
  pointer reaches it. This does not reproduce with the default brown.

- **A favicon skips the width ladder, and must render `unoptimized`.** The client
  pipeline re-encodes to JPEG, destroying the transparency a mark needs, and scales to
  2400px — so the mark is stored exactly as uploaded. That means no `-400` derivative
  exists, and without `unoptimized` the loader asks for one anyway: `/media` misses,
  falls through to its base-key branch, and reads R2 twice on the header of every page
  while looking entirely correct. `src/app/icon.svg` also had to move to `public/`,
  because file-based metadata always beats `metadata.icons` and the setting was ignored
  while it sat there.

- **`cloudflare-env.d.ts` is generated, and CI must generate it too.**
  `@opennextjs/cloudflare` declares a global `CloudflareEnv` carrying its own
  bindings and nothing else, so `DB` and `MEDIA` exist for TypeScript only in the
  file `wrangler types` writes from `wrangler.jsonc` — which is gitignored, because
  it is 580KB of runtime types that would have to be regenerated on every binding
  change anyway. The failure is quiet in the worst way: a developer machine has run
  `pnpm cf-typegen` at some point and is clean forever, while every CI run fails
  `typecheck` _and_ `build` on nine TS2339s in code nobody touched. `pnpm cf-typegen`
  runs before both. It reads the config only — no account, no network, and no prior
  build, despite the `WORKER_SELF_REFERENCE` type pointing into `.open-next`, which
  `skipLibCheck` never resolves.

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

- **`/_next/image` returns 404 in the deployed Worker, so the loader is not optional.**
  `src/image-loader.ts` addresses the ladder's objects by naming convention and `/media`
  falls back to the base object when a rung is missing. Removing the custom loader
  silently breaks every image in production while leaving `next dev` working — which is
  exactly how this was missed until the worker was actually exercised.

  Superseded, in part: the rungs used to be rendered by the _browser_ at upload, on the
  grounds that Cloudflare Images charges per transformation. That reasoning held only
  for transforming on the way out — see the invariant about it running once per image —
  and its cost was real: a canvas cannot encode AVIF at all, so the site served JPEG
  everywhere while the brief called for AVIF/WebP.

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

- **The product type is free text, not an enum.** `listings.kind` was `print | digital`,
  which decided for the artist what she is allowed to sell; the column is dropped and
  `label` holds whatever she types. Nothing groups or filters by it — under fifty pieces,
  the grid is the whole catalogue and scrolling is faster than searching it.

- **One listing per piece is a decision about the admin, not the schema.** The dialog
  edits a single product type, link and price, and `soleListing` is where that is named;
  the `listings` table still holds many rows per artwork, so sizes and formats can come
  back without a migration. Anything beyond the first is left in place and simply not
  offered. An empty Etsy link is how a piece is shown but not sold — saving deletes the
  listing rather than leaving a button pointing nowhere.

- **The store grid uses a menu button where the wall uses long-press.** Both need a
  context menu on a tablet, but the grid also needs drag-to-reorder, and dnd-kit's
  `TouchSensor` claims the hold at 180ms to start the drag — so a 500ms long-press would
  be fighting the reorder for the same gesture. The wall has no such conflict because its
  drag begins immediately. Right-click still works on a desktop.

- **Portfolio and store are separate collections.** `portfolio_items` drives the home
  page and has no price; `artworks` + `listings` are the store. They share the upload
  endpoint and the `ImageManager` component but nothing else. Do not merge them — the
  brief treats "shown" and "for sale" as different things.

- **The size list is not a native `<select>`, and not a `FloatingLayer` either.** Native
  was tried first and the reasoning looked sound — reliable on a tablet, no dismissal to
  own — but a native popup is drawn by the operating system, and with a rung for every
  point from 5 to 40 macOS paints all forty-three from the top of the screen to the
  bottom. No CSS reaches that menu; `appearance: base-select` is the only hook and it did
  nothing here. A list that cannot be told how tall it is cannot be the answer.
  `FloatingLayer` is the other trap: it closes on any pointerdown outside itself and this
  control sits _inside_ one, so a portalled list reads as a click elsewhere and takes the
  formatting panel down on the way to picking a size. Rendered inline and absolutely
  positioned, a click on an option is a click inside the panel — which is what
  `ColourControl` beside it already relies on. Escape is caught in the capture phase and
  stopped, so one press closes the list and not the panel behind it.

- **A size mark's `em` is rebased; its `data-rt-size` is not.** A run's size is a
  multiple of the _box_, which is what `marksOf` reads back — but the style is `em`, a
  multiple of the _parent_, and the two only agree when the span is a direct child of the
  editor. Nested, they multiply: 30pt applied inside a half-size run painted half of 30
  while storing the full multiple, so the editor and the saved document disagreed and
  every further adjustment drifted from the last. `rebaseSizeStyle` divides the style by
  what the span inherits and `clearMarks` drops the marks it wrapped around;
  `applySpanMark` calls both _after_ insertion, because extracting a selection splits the
  surrounding elements and where the span lands is the only reliable answer to what it
  inherits. This is why the size control could be seen to move the wrong way.

- **A new mark replaces the marks of its own kind inside it — colour and face, not just
  size.** Size was cleared because a nested `em` multiplies; colour and face were left
  because they do not. But they do not need to compound to break: nested, the innermost is
  both what the browser paints and what `marksOf` reads, so a colour laid over text that
  already had one changed nothing whatsoever. The artist reported it as black not
  applying. It reads as stale state and is the opposite — the old colour is still there,
  winning — and it looks intermittent because the failure depends on the gesture: dragging
  across a coloured word puts the span inside the range and fails, while double-clicking
  it puts the range inside the span, so the new mark nests within the old one and the
  innermost is the new one. `clearMarks` now takes the kinds being applied.

- **`removeFormat` clears the styles and leaves the `data-rt-*` attributes.** So "Clear"
  emptied `style` on every span it touched, the text went plain on screen, and `marksOf`
  went on reading colour, face and size off the attributes — the box looked cleared and
  published coloured. The attribute is deliberately the thing that is read back, which is
  what makes a browser command that only knows about styles unable to finish the job.
  `clearMarksInRange` strips both halves from everything the selection touches, and the
  editor calls it after every `removeFormat`.

- **`scrollIntoView` cannot be told where to stop, so the size list does the sum itself.**
  It scrolls every scrollable ancestor, which is right for the list and wrong for
  everything above it: in the settings form, where the control sits in the document flow,
  opening the dropdown scrolled the page to centre it and the page jumped. The wall never
  showed this and could not have — its formatting panel is `position: fixed`, and a fixed
  element's chain of scrollable ancestors ends at the viewport, so the identical call was
  correct there. `src/lib/list-scroll.ts` holds the arithmetic, pure and unit-tested
  because jsdom has no layout, and `focus` takes `preventScroll` for the same reason. A
  row's offset is measured against the list rather than read from `offsetTop`, which is
  relative to the nearest _positioned_ ancestor: that is this list today only because it
  is absolutely positioned, and the failure if it ever stopped being so is every row
  scrolling to the end of the ladder.

- **A size the artist cannot get is never offered.** Both point fields derive their bounds
  the same way they always did — from `WALL_TEXT_CQW` for a box and from
  `RICH_LIMITS.size` against `basePt` for a run — but the bounds now filter the list
  rather than clamp a choice. A spinner let her land on a number that silently became a
  different one; a shorter list is the honest form of the same limit. `ptOptions` also
  merges the current size in when it is off the ladder, because a `<select>` whose value
  matches no option renders blank — and the home page's heading, seeded at 5.2cqw, is
  about 51pt.

- **`SURFACE_LEADING` is a hand-kept copy of a Tailwind class, in a different file from
  every class it copies.** Line spacing is quoted to the artist in points, so the control
  has to state the surface's _own_ spacing before she has chosen one — and it cannot read
  `leading-none` off a class. Those numbers live in `type-scale.ts` while the classes live
  on the wall (`portfolio-wall.tsx`, and twice in `portfolio-canvas.tsx`) and on the copy
  fields (`rich-copy-field.tsx`, `about/page.tsx`, `privacy/page.tsx`). Change a class
  without changing the constant and nothing breaks loudly: the control quotes a spacing
  the surface is not set to, and — worse — the value that means "follow the surface" is
  now a number she can no longer pick, so returning a paragraph to the default becomes
  impossible while every control still looks right.

- **Rich text is stored as a document and rendered as elements, never as HTML.** The
  obvious shape — keep a string of HTML, render it with `dangerouslySetInnerHTML` — puts a
  script-injection surface behind an admin password and a sanitiser that has to stay right
  forever. `src/lib/rich-text.ts` holds paragraphs of runs, `src/components/rich-text.tsx`
  turns runs into elements, and there is no path from stored text to executable markup at
  all. Do not add an HTML column or a `dangerouslySetInnerHTML` to this path.

- **`docFromElement` is where a paste stops, and it works by not looking.** It walks the
  contenteditable DOM reading only the marks it recognises, so a paste carrying a script,
  an `onerror`, or an iframe contributes its text and nothing else — not because those are
  stripped, but because nothing ever reads them. The one field that can still carry
  something executable is `href`, which is why `safeHref` has a protocol allowlist and why
  a protocol-relative `//evil.com` is rejected: it reads as relative and is not.

- **Every rich document is sanitised on read as well as on write.** A row can predate a
  rule or be edited by hand with wrangler, and the server action re-sanitises because it
  is a public endpoint — the editor's output is a suggestion, not a guarantee.

- **Each rich column has a plain-text mirror, written from the same document.** `content`
  on `wall_texts` and `about_copy`/`contact_copy`/`privacy_copy` on the settings row are
  not legacy: the wall picks its `<h1>` by comparing text, metadata and OG cards need
  words without marks, and a `rich` column that fails to parse degrades to the mirror
  rather than to a blank page. Write one without the other and they drift silently.

- **The editor is uncontrolled, and `execCommand` is a deliberate choice.** React
  re-rendering the children of a contenteditable moves the caret to the start on every
  keystroke, so the document is written into the DOM once and read back, never diffed —
  which is what the `emitted` ref guards. And "apply to what I type next, without
  altering what is already there" is exactly `execCommand`'s collapsed-selection
  behaviour; reimplementing it means owning caret restoration through every render.

- **A trailing `<br>` in a block is filler, not a line the artist typed.** Every empty
  block carries one so it can hold a caret, and Chrome appends one after a final line.
  Counted as a break, a single blank line round-trips into two and the wall grows a gap
  every time it is saved.

- **The site layout owns the vertical space around the page; no page sets its own.**
  Every page used to carry its own `pt-*`/`pb-*` — between `pt-10` and `sm:pt-24` — and the
  footer added a further `mt-24` underneath, so the gap above the content and the gap below
  it were never the same number, on any page. One `py-[var(--content-space)]` on `#main`
  replaces all of it, which is what lets a single control keep the two ends equal. Putting
  vertical padding back on a page silently breaks that setting for that page only.

- **The header's height is a `min-height`, and the panel has to say so.** A fixed height
  would clip the artist's name in a large face, and would fight the nav wrapping to a
  second row on a phone — so the bar grows instead. That makes the control look broken at
  the point it matters most, which is why `exceedsHeight` exists and the settings panel
  reports the height the bar will actually be. The lower bound of 56 is load-bearing for
  the same reason from the other side: the mark is a fixed 36px inside 16px of padding, so
  below 52 the mark would decide the height and the slider would do nothing at all.

- **The header tokens are emitted by the site layout, never the root layout.** Same
  reasoning as `--site-body` and `--site-display`, and they share the same `<style>`
  element: the studio must keep its own chrome whatever the artist sets, or the bar she is
  editing changes under her while she edits it. The settings preview scopes the identical
  tokens to its own element instead, which is what lets it be faithful without repainting
  the admin. That `<style>` still must never carry a `precedence` prop.

- **A wall is a `WallScope`, never a parent id.** There are three — home, one of the
  artist's custom pages, and a single piece's own page — and the database says which with
  two nullable columns, `parent_id` and `page_id`, where home is the pair of nulls. A read
  that filters one column and forgets the other does not fail; it silently shows a custom
  page's work on the home page. `scopeColumns` in `src/lib/portfolio.ts` is the only thing
  that writes the pair and `onWall` in `portfolio-queries.ts` the only thing that reads it,
  so the illegal both-set state has nowhere to come from. Do not reintroduce a bare
  `parentId` parameter. Reading from a published revision needs the same rule against
  objects rather than SQL, which is `isOnWall` — built out of `scopeOf` rather than
  testing the two columns a second time, so there is still only one place that reads
  the pair.

- **A piece's back link follows the wall it is shown on, and the two surfaces differ.**
  `/work/<slug>` and the studio's piece editor are reached from whichever wall the piece
  sits on, so a hardcoded link home silently loses the visitor's place. The public page
  falls back to home when that wall is a draft custom page — the piece's own URL still
  resolves while its page does not, so linking to it would offer a 404 — while the studio
  follows the draft, because the artist can reach it perfectly well.

- **A custom page is a wall, not a piece's page, and `isInteractive` must keep ignoring
  `pageId`.** Work shown on one behaves exactly as it does at home: clickable, with a page
  of its own. Only `parent_id` makes an element inert. Widening the test to "is this row
  scoped to anything" would pass the existing child test and quietly strip every custom
  page's work of its link — which is why `portfolio.test.ts` asserts both cases together.

- **Custom pages live at the top level, so `RESERVED_PAGE_SLUGS` is load-bearing.** Next
  resolves `/about` to the static route before it reaches `[pageSlug]`, so a page allowed
  to take that name is not a conflict the artist would ever see — it is a page she can
  edit and can never visit. A reserved name is treated as a clash and gets a number, and
  the slug field shows her what was actually saved. That dynamic segment also catches
  every unmatched one-segment URL and calls `notFound()`, which lands where it always did.

- **`getNavPages` swallows its errors; `getAllSitePages` does not.** The first runs in the
  header of every public page, so a deploy that skipped `db:migrate` would take the whole
  site down rather than the feature — it degrades to the nav the site had before. The
  studio's read is deliberately unguarded, because an empty bar would invite the artist to
  build her pages a second time. As with `getSiteSettings`, the `console.error` is the
  only signal that anything is wrong.

- **Drizzle drops `ON DELETE CASCADE` from `ALTER TABLE ... ADD COLUMN`.** Both `page_id`
  columns were generated without it and the clause was restored by hand in
  `migrations/0010_site-pages.sql`. Without it, deleting a page leaves its wall content
  behind pointing at a row that no longer exists — invisible, because every wall read
  requires a scope that now matches nothing. Regenerate that migration and you must put
  the clause back.

- **Both `parent_id` columns hit that same defect, were never repaired, and now
  cannot be.** `migrations/0005_piece-pages.sql` emitted a bare
  `REFERENCES portfolio_items(id)` on `portfolio_items` and on `wall_texts`, while
  `src/db/schema.ts` has always declared `onDelete: "cascade"` on both. The model and the
  database disagreed for fifteen phases, and the bill arrived as `FOREIGN KEY constraint
failed` on every attempt to delete one of the 13 pieces (of 47) that owned elements on
  a page of their own. React redacts a server exception in production, so what reached
  the artist was `Minified React error #441` — a number that decodes to "an error
  occurred", naming neither the table nor the constraint.

  The repair is not available. SQLite cannot alter a foreign key in place, and the
  table-rebuild it demands is impossible on D1 from either direction: migrations run
  inside a transaction, SQLite ignores `PRAGMA foreign_keys` inside one, and
  `PRAGMA defer_foreign_keys` is not a substitute — it postpones the _checking_ of
  constraints but not the _firing_ of actions, and `DROP TABLE` performs an implicit
  delete of every row, which would cascade through `portfolio_images.item_id` and take
  every image row in the site with it. Both routes were tried against a restore of the
  production database and both were refused, cleanly, changing nothing.

  So the cascade lives in `src/lib/portfolio-deletes.ts` instead, and all three delete
  paths go through it. **`src/db/schema.ts` is lying about these two columns** — the
  declaration is kept because it states the intent, and because removing it would make
  `drizzle-kit generate` emit a migration nobody can apply. Do not "simplify" the child
  statements away on the strength of reading the schema; `portfolio-deletes.test.ts` is
  there to stop you.

- **A delete that sweeps R2 must sweep before it deletes, and that ordering has a cost.**
  `releaseMedia` runs first in all three paths, so a delete that then fails at the row
  level has already given up the objects: the piece stays on the wall with a broken image
  and no way back. That is the state repeated attempts left behind while the cascade was
  missing. The ordering is still right — the alternative loses the keys altogether when
  the row goes and the sweep fails — but it is why a failing delete is not a no-op, and
  why the fix had to make the row delete unable to fail rather than merely report better.

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
  `RichTextEditor` (injected, not imported, for this reason) and the `isKnownFontId` guard
  in `updateWallText`.

- **Floating surfaces go through `FloatingLayer`.** It portals to `document.body`,
  keeps itself inside the window and closes on Escape or an outside click. Both the
  context menu and the wall's floating surfaces use it, so the stacking and dismissal
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

- **Superseded: long-press stands in for right-click, and is not optional.** It was
  written when the artist was believed to work on an iPad. She does not — she works at a
  desktop computer, with a mouse and a keyboard, and the brief is corrected at v0.4. The
  long-press is still there and still works; it is simply no longer the only route to the
  context menu, and no feature need be compromised to keep a touch gesture available. It
  still cancels the moment a gesture becomes a drag.

- **The marquee is mouse-and-pen only, and that is the whole answer to the touch
  question.** A finger drag on bare canvas is how a long wall is scrolled, and the wall's
  container deliberately has no `touch-none`. Claiming that gesture for a rubber band
  would cost a real behaviour to add one whose other half — shift-click — needs a
  keyboard anyway. `beginMarquee` returns on `pointerType === "touch"`, which is why the
  page still scrolls under a finger and why nothing here needed a mode switch.

- **A group's scale handle is clamped inside the canvas, and is not a corner of the
  selection box.** Work may bleed past the wall's edges on purpose — the layout clamps run
  to -25% and 125% — and the canvas is `overflow-hidden`, so a handle hung off the true
  bottom-right corner is clipped away entirely whenever the artist has selected something
  that bleeds. The failure is total and silent: the selection looks right and cannot be
  scaled. The handle is a sibling of the dashed box, positioned at the bounds clamped into
  [0, 100] and [0, ratio]; the scale itself is still computed from the real bounds. Do not
  tidy it back onto the box.

- **A layout save for a selection is one `db.batch`, not a write per element.** Same
  reasoning as the reorder `CASE` statement: a group move is a set of related changes, and
  a dropped connection halfway through would leave the arrangement half moved — worse than
  not having moved at all, because the artist cannot see which half is which.

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

- **The mobile menu is a `<details>`, because navigation must not depend on hydration.**
  The same rule the fade already carries, and the top bar has the stronger claim to it:
  a fade that does not run is a page that appears plainly, while a menu that does not run
  is a site with no way around it. The first version was a `<button>` with an `onClick`,
  and on a phone it was a hamburger that could be seen and not pressed — the artist found
  it, and the giveaway was that the lightbox was dead on the same page while the Instagram
  link beside the button, being a plain `<a>`, still worked. A summary is also a button
  with an expanded state already announced, so there is no `aria-expanded` of ours to keep
  in step. The element is uncontrolled and closed by writing `open` on the node: React must
  not hold a second opinion about a thing whose whole purpose is to work when React does
  not. Turning it back into a button with state is the obvious tidy-up and it reintroduces
  the bug.

- **A summary's marker takes three rules to remove, and they belong on the element, never
  on `summary`.** A summary is a `list-item` by default, so `display: block` is what removes
  the marker; `list-none` covers Blink and Gecko, and `[&::-webkit-details-marker]:hidden`
  covers the WebKit that predates `::marker`. None is redundant — the first two are ignored
  by a browser drawing the legacy pseudo-element and the third is a no-op everywhere else —
  and `list-style: none` alone was tried first and was not enough on the artist's iPhone.
  The `display` also fixes a second-order fault: the legacy marker is an inline-block
  pseudo-element _inside_ the summary, so a block-level child lands on the line beneath it,
  which is why the hamburger appeared under the triangle rather than beside it.

  Writing them as `summary { … }` in `globals.css` is the obvious tidy-up and it is wrong
  twice over. The studio's shop dialog has a "More details" expander whose entire affordance
  is its native triangle, so an element selector reaches a summary that wants the opposite
  of this one and silently strips it — on a desktop surface nobody is looking at while
  working on a phone. And a rule that lives only in the stylesheet can fall out of step with
  the markup that needs it: moving the class there brought the triangle back in _every_
  browser, because a dev stylesheet can be stale while the HTML beside it is not — see
  "Running it locally". The summary is still never laid out as `flex`, which has a history
  of taking the disclosure behaviour with it in WebKit, so the flex box is a span inside it.

- **The menu glyph is aligned to the start of its tap target, never centred in it.** A 40px
  box around a 22px glyph is there for the thumb, and centring the glyph inside it makes
  the glyph's position depend on the box having a resolved width — so the one browser where
  that width did not land put the hamburger in the middle of the screen while every other
  browser looked perfect. Aligned to the start the box may be any width at all and the bars
  stay flush with the content column, which is where they belong regardless. The rule
  generalises past this button: an icon positioned by centring inside a sized box fails
  visibly when the size fails, and one positioned by alignment does not.

- **A glyph carries `width` and `height` attributes as well as classes.** An `<svg>` with a
  `viewBox` and no intrinsic size collapses to nothing in WebKit inside a flex container
  while Blink gives it a default box — so a stylesheet that has not arrived is an icon
  missing on an iPhone and merely mis-sized on Android, which arrives as two bug reports
  rather than one. The attributes lose to any class that does arrive, so they cost nothing.

- **The reveal is one shared scroll sweep, and must never split into two mechanisms.**
  It used to pick per element: on screen at mount meant a timer, below the fold meant an
  IntersectionObserver. Which path dominates is decided by the breakpoint. Above `md` the
  wall is bounded by an `aspect-ratio` and is roughly one screen tall, so almost every
  piece took the timer. Below `md` it is a stack thousands of pixels tall, so almost every
  piece took the observer — which never delivered, leaving the whole gallery blank until
  the layout's failsafe fired. The bug therefore looked like "Safari is broken" when it was
  really "tall pages are broken", and a fix aimed at one engine could not have found it.
  `src/components/fade-in.tsx` now keeps a single module-level set of pending targets and
  measures them with `getBoundingClientRect`, so every piece is revealed the same way.

- **The whole reveal is the inline script, and `FadeIn` is not a client component.**
  Nothing can fade in while `js-fade` hides it, so any reveal that waits for the bundle is
  a wall that waits for the bundle. Splitting it made that worse rather than better: with
  the opening pass inline and the rest in React, a phone showed the first screenful and
  then nothing, because hydration never completed and the safety net had been disabled by
  its own guard (below). The script in `src/lib/fade-script.ts` now owns scroll, resize,
  image `load` and a poll, and `src/components/fade-in.tsx` only emits the class. A fade is
  presentation; it must not depend on hydration. Do not move any part of it back.

- **The safety net asks whether a pass ever ran, never whether anything is visible.** The
  visible test looked equivalent and was not: the opening pass always reveals something, so
  the net switched itself off permanently and stranded everything below the fold the moment
  it started working. It also must not reveal on its deadline — that flattens the feature
  into a five-second delay, which is exactly what the bug looked like from a phone.

- **`src/lib/fade-script.test.ts` runs the real script against a DOM, and the assertions
  about events must advance the clock by less than the poll.** The reveal broke three times
  while `reveal.ts` was fully unit-tested, because every failure was in the wiring rather
  than the arithmetic. The first version of the DOM test was worthless for the same reason
  in miniature: it advanced far enough for the poll to do the work, so it passed with the
  scroll listener deleted. Each mechanism is now proved by deleting it and watching exactly
  one test fail.

- **That sweep listens for `load` in the capture phase, and that line is load-bearing.**
  Images arriving reflow everything beneath them without firing a scroll event, so without
  it the pieces under the fold are measured once, at the wrong position, and never again.
  Capture, because `load` on an image does not bubble.

- **A piece is measured before its image has loaded, so it can be zero-high.** A zero-high
  box has `bottom === top`, so the obvious `rect.bottom > 0` test rejects anything sitting
  at the very top of the document and strands it for good. `isWithinRevealBand` floors the
  height at a pixel for exactly this reason. The timing and geometry live in
  `src/lib/reveal.ts`, pure and unit-tested, because measuring this in a browser proved
  unreliable.

- **A lazily loaded image that sizes itself from its content never loads.** The
  lightbox picture is `w-auto` so it can be letterboxed by `max-h-full`, which means it
  has no width until it has loaded — and an element of zero size never intersects the
  viewport, so the observer behind `loading="lazy"` never fires and it never loads. The
  deadlock only broke when something unrelated forced a re-layout, so it read as an
  intermittently slow image rather than a bug, and it sat in the shop's lightbox from the
  day it was written. `loading="eager"` is the fix and costs nothing here: a dialog that
  is never opened never renders its contents. `priority` would be the wrong tool — it
  preloads from the page that owns the lightbox, for a picture most visitors never ask
  for. The rule generalises: any image whose box comes from its own content cannot also
  be lazy.

- **The fade hides before first paint, via an inline script, not from React.** Hiding
  from the component meant the wall painted once, vanished, then faded — a visible
  flicker. The `fade-target` class now ships in the markup but the CSS only acts on it
  under `.js-fade`, which a small inline script at the top of the site layout adds while
  the document is still parsing, ahead of the wall. With scripting off the class is never
  added and the page simply renders.

- **Loading priority is chosen by size and position, never by array index.** The wall's
  array is ordered by layer, so `priority={i === 0}` prioritised whichever piece happened
  to sit at the back. `lcpCandidateId` picks the largest piece above the fold.

- **At most two pieces are eager; everything else is lazy.** The rest of the first screenful
  used to opt out of lazy loading as well, chosen by `y` — a coordinate on the desktop
  arrangement, which does not exist below `md`. On a phone those pieces are a stack in
  reading order, so the ones marked eager were mostly far down the page and fetched at
  full size regardless. Eight 1600px JPEGs decoded at once is past what a phone will hold,
  so it evicted and refetched them in a loop and the artwork visibly disappeared and came
  back while scrolling. Lazy costs desktop nothing, because `loading="lazy"` does not defer
  an image that is already in the viewport — it defers only what the visitor cannot see.

- **The two layouts disagree about which image is the LCP, and one set of markup serves
  both.** Above `md` it is the largest piece near the top of the arrangement; below `md`
  that arrangement does not exist and it is simply whatever heads the stack. Prioritising
  only the desktop answer left the mobile LCP lazily loaded, which Next warns about and
  which costs the metric the brief puts a budget on. `eagerIds` returns both, which is one
  piece as often as two — and never the first-screenful fan-out that flooded a phone.

- **The reveal never retires, and its listeners must outlive the page it started on.**
  Skipping the measurement when nothing is pending is free and correct — `querySelectorAll`
  costs nothing, `getBoundingClientRect` forces a synchronous layout — but tearing the
  listeners and the poll down is not. A client-side navigation mounts fresh targets into a
  document where `js-fade` is still set, so a retired reveal leaves them hidden with nothing
  left to show them: going into a piece's page and back rendered an empty home page.

- **`FadeIn` carries `suppressHydrationWarning`, for the same reason `<html>` does.** The
  script reveals by adding classes to that element, and on a phone it has usually finished
  long before the bundle arrives to hydrate — so the class list React finds can never be
  the one it sent. The divergence is the mechanism, not a fault. It covers that element
  alone, so a genuine mismatch anywhere else is still reported.

- **`images.deviceSizes` must stay identical to `WIDTH_LADDER`.** Next builds the srcset
  from `deviceSizes`, and `src/image-loader.ts` then rounds each width up to a rung that
  exists in R2. With Next's defaults the two lists disagree and every width is rounded
  twice: a phone needing 774px picked Next's `828`, which the loader rounded to `1600` —
  twice the image and four times the decode memory, for nothing. Change one list and you
  must change the other.

- **The wall's mobile `sizes` is deliberately smaller than the slot it fills.** At `90vw` a
  3x phone asks for ~1050px and lands on the 1600 rung; at `60vw` every current phone lands
  on 800, a quarter of the decode memory and still over twice the density of the slot. This
  looks like a mistake and is not — the honest figure is what put the gallery past what a
  phone can hold.

- **The fade lets go of the transition once it has run.** A transform is what puts a piece
  on its own compositing layer, and below `md` the wall is a tall stack of large images —
  holding every one of them on a layer is the other half of the memory problem above. The
  `is-settled` class drops the transform and the transition a moment after the reveal.

- **The failsafe reveals the wall; it does not unhide it.** Removing `js-fade` dropped
  every piece in at once, unfaded — which is precisely what a visitor on a phone saw each
  time the reveal failed, so the safety net was itself mistaken for the bug. It now adds
  `is-visible`, making the worst case a graceful fade.

- **The fade defers the LCP, by design.** An element at `opacity: 0` is not contentful, so
  the metric is recorded when a piece reveals rather than when it loads — and the
  _later_-revealing piece can become the LCP rather than the largest. Worth remembering if
  the LCP budget in the brief ever comes under pressure: turning the fade off is the
  lever.

- **`<html>` carries `suppressHydrationWarning`, and must keep it.** The inline script
  adds `js-fade` to that element before React hydrates, so the client class list will
  never match what the server sent — that divergence is the mechanism, not a fault. The
  attribute covers only that element, so a genuine mismatch anywhere else is still
  reported.

- **That inline script carries a five-second failsafe**, which removes `.js-fade` if no
  piece has been revealed by then — the signal that hydration never happened. Without it,
  a bundle that failed to load would leave the gallery permanently blank.

- **Superseded: the fade-in never hides content in server markup.** `.fade-target` is applied by
  `src/components/fade-in.tsx` after it mounts, never rendered by the server. Markup that
  started hidden would stay hidden for good if the script failed to load. A `<noscript>`
  override and a `prefers-reduced-motion` rule cover the other two ways it could strand
  content. The editor never fades — the artist has to see what she is arranging.

- **Known debt: the custom 404 never renders.** `src/app/(site)/not-found.tsx` — the
  "Walked off somewhere" page with the mirrored mark — is not picked up, so both unmatched
  URLs and `notFound()` from a site route fall through to Next's default "This page could
  not be found". It has been this way since the pages moved into the `(site)` route group.
  Fixing it means deciding whether the 404 should carry the site header and footer, which
  a root-level `app/not-found.tsx` would not get for free.

- **The wall renders once; CSS decides the layout.** Position, size and reading order
  arrive as custom properties on a single set of elements, and the breakpoint only changes
  how they are used. Rendering a stack and an arrangement separately cost double the HTML,
  put two `<h1>` elements in the source and made the browser fetch the priority image
  twice. Adding a second tree back would undo all of that.

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
pnpm cf-typegen                  # writes cloudflare-env.d.ts, or typecheck fails
pnpm db:migrate:local            # creates the D1 tables
pnpm seed                        # loads eight placeholder artworks into D1 and R2
```

Then either:

**Changing `database_id` in `wrangler.jsonc` gives you a new, empty local database.**
Miniflare keys local D1 storage by that id, so the first `pnpm preview` after the remote
database was created found no tables and every page 500'd. The old data is not lost — it
is still in `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` under the previous id's
filename, and copying it over the new one restores it. Otherwise `pnpm db:migrate:local`
and `pnpm seed` rebuild it.

```bash
pnpm dev          # fast iteration on http://localhost:3000
pnpm preview      # the real Worker on http://localhost:8787 — build first, slower
pnpm preview:lan  # the same, reachable from a phone at http://<this-machine>:8787
```

**A CSS change in `pnpm dev` can be cached stale while the HTML is not.** Turbopack serves
one stylesheet at a stable URL — `[root-of-the-server]__<hash>._.css`, where the hash names
the chunk and not its contents — so the address does not change when the file does. A
browser holding the previous copy therefore pairs it with freshly rendered HTML, and the
symptom is a rule that is provably in the file, provably served, and provably not applied.
It cost real time on the mobile menu: a marker suppressed by a utility class was moved into
`globals.css`, and the disclosure triangle came back on every browser at once. Curling the
stylesheet proves what the _server_ has and nothing about what the browser is using —
hard-reload before believing a CSS change did not work, and prefer keeping a rule on the
element that needs it.

**Test in `preview` before believing anything.** `next dev` does not run the deployed
worker and will happily hide production-only failures. The missing image optimiser in
Phase 2 is the worked example: every image on the site was broken in the worker while
`next dev` looked perfect.

**On a phone, `pnpm preview:lan` — not `pnpm dev`.** `next dev` binds every interface, so
a phone can reach it and it becomes the path of least resistance; `wrangler dev` binds
localhost, so plain `preview` cannot be reached and the temptation is to fall back. What
`next dev` adds is a Fast Refresh websocket, and a phone that drops it — by backgrounding
the tab, or over patchy wifi — gets a full page reload on reconnect. That is
indistinguishable from the site reloading itself, and it cost real time during the mobile
fade work: repeated `GET /` in the dev log was read as the page misbehaving. Find this
machine's address with `ipconfig getifaddr en0`.

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
