# Project Brief / PRD — Artist Portfolio Site

Status: **Draft v0.3** · Owner: James Maxwell · Last updated: 2026-08-31

> Changed in v0.2: on-site checkout removed. The site is a portfolio that links out to
> the artist's Etsy shop. Rationale and the fee trade-off are in §13; §17 covers bringing
> checkout back in-house later if the numbers justify it.
>
> Changed in v0.3: **Cloudflare free tier confirmed** as the hosting decision (§11).
> **Etsy shop confirmed** — the artist is creating it now, unblocking Phase 3 (§15 Q1).

---

## 1. Summary

A portfolio website for a single artist. It shows the work beautifully, and every
purchasable piece links out to its **Etsy listing**, where Etsy handles payment,
delivery, tax and customer service. Sales of **limited-edition prints** (posted by the
artist) and **digital downloads** (auto-delivered by Etsy) both live there.

Three design principles, in priority order when they conflict:

1. **Send visitors to Etsy ready to buy.** The site's job is desire and trust; Etsy's job
   is the transaction. The handoff must be obvious and never feel like a dead end.
2. **Self-serve.** The artist can add, remove and rearrange artwork herself, from her
   phone, without a developer and without breaking the design.
3. **Cheap to run.** Target fixed cost of **under £2/month**. No platform subscription.

The site holds no money, no customer data, and no orders. That is the point.

## 2. Goals & success measures

| Goal                | Measure                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| The handoff works   | Every published artwork with a listing reaches the correct live Etsy page in one tap    |
| Artist independence | Artist publishes a new artwork with images and an Etsy link unaided, in under 5 minutes |
| Cheap               | Fixed monthly infrastructure cost ≤ £2 excluding domain renewal                         |
| Fast                | Mobile LCP < 2.0s on a 4G connection; Lighthouse Performance ≥ 90                       |
| Findable            | Artist's name ranks #1 for her own name; artwork pages are indexed                      |
| Measurable          | Outbound clicks to Etsy are tracked, so we know whether the site earns its keep         |

## 3. Non-goals

Explicitly out of scope. Listed so they don't creep in.

- **Any checkout, cart, or payment on our domain.** No Stripe, no orders, no stock.
- Syncing prices or stock from Etsy's API in v1 (see §9 for why, and the manual approach).
- Accounts or login for visitors.
- Full page-builder / theme editor. Layout and visual design are code, not data.
- Blog, events calendar, commission booking.
- Multi-artist or gallery features.

## 4. Users

**Visitor / buyer.** Arrives from Instagram or a search for the artist's name, mostly on
mobile. Wants to look at big images without friction. Will follow a clear "Buy on Etsy"
link, but will bounce if the link is broken or the price is a surprise.

**The artist (admin).** Non-technical, on an iPad or phone. Wants to upload a batch of
photos, drag them into an order she likes, paste an Etsy link, and get back to painting.
Must not be able to accidentally destroy the site.

**Developer (us).** Maintains it occasionally. Optimises for a codebase that can sit
untouched for six months and still deploy.

## 5. Key journeys

**J1 — Discover and buy.** Home → grid → artwork page → "Buy on Etsy" → Etsy listing in a
new tab. Outbound click is recorded.

**J2 — Artist adds work.** Log in via emailed magic link → New artwork → drag in photos →
title/year/medium → paste Etsy URL and indicative price → publish. Site updates within
seconds.

**J3 — Artist rearranges the gallery.** Arrange view → drags thumbnails into a new order →
autosaves. This is the artist's most-used feature after uploading and must be genuinely
pleasant on touch.

**J4 — A piece sells out.** Artist toggles the artwork to "Sold" in the admin. The page
stays live, the buy button is replaced by a sold state and an enquiry link.

## 6. Data model

Deliberately small. No orders, no stock, no money held.

- **Artwork** — `slug, title, year, medium, description, dimensions_note,
status(draft|published|archived), sort_order, is_featured`.
- **ArtworkImage** — `artwork_id, storage_key, alt (required), width, height, lqip,
sort_order, is_primary`. Many per artwork.
- **Listing** — the outbound offer. `artwork_id, kind(print|digital), label (e.g. "A2
unframed"), etsy_url, price_pence_display, availability(available|sold_out|hidden),
sort_order`. An artwork with no active listings is display-only. Zero or many per artwork.
- **SiteSettings** — single row. `hero_artwork_id, announcement, etsy_shop_url,
contact_email, instagram_url`.

`price_pence_display` is **indicative only** and is never authoritative — Etsy is. See §9.

The `Listing` shape intentionally mirrors what a sellable variant would need, so adding
on-site checkout later is additive rather than a migration (§17).

## 7. Requirements — public site

- P-01 Home page: hero image (artist-selected) and a curated grid of featured work.
- P-02 Work index: responsive grid of published artworks in the artist's chosen order.
  No filters or search in v1 — the catalogue is under 50 items.
- P-03 Artwork page: large images with a lightbox and pinch-zoom, metadata, and the buy
  panel. Multiple images per artwork, swipeable on mobile.
- P-04 **Buy panel:** one clear primary button per listing — "Buy on Etsy — £45". Opens in
  a new tab with `rel="noopener noreferrer"`. Multiple sizes render as multiple buttons.
- P-05 Prices are labelled as indicative, with Etsy stated as the source of truth. Short
  and unfussy — "Prices and availability on Etsy" beneath the buttons, not a disclaimer wall.
- P-06 Sold-out artworks stay published and viewable; the buy button becomes a sold state
  with a link to contact or to the shop's other work.
- P-07 Artworks with no listing show no buy panel at all — no empty state, no broken link.
- P-08 Archived work remains viewable at its URL. Never 404 a URL that has been shared.
- P-09 A persistent, low-key link to the Etsy shop front in the header or footer.
- P-10 Supporting pages: About, Contact (form → email; honeypot + rate limit), Privacy.
  **No shipping or returns pages — Etsy's policies govern, and duplicating them creates a
  contradiction we'd be liable for.** Link to Etsy's shop policies instead.
- P-11 Outbound Etsy clicks fire an analytics event carrying the artwork slug.
- P-12 Newsletter signup — _deferred, not v1._ Noted because Etsy keeps the customer
  relationship, so an owned mailing list is the main way to claw any of it back.

## 8. Requirements — admin

Built around the artist's stated need: **move images around, add and remove images.**
Plus the minimum to manage links.

- A-01 **Auth:** passwordless magic link to a single allowlisted email address. No public
  signup route exists. Session cookie, httpOnly, 30-day expiry.
- A-02 **Upload:** multi-file drag-and-drop, and camera-roll picking on mobile. Files go
  **direct to object storage via a presigned URL** — never through the serverless function.
  Client-side downscale before upload so a 60MB TIFF doesn't stall on mobile data.
- A-03 On upload, derive responsive sizes and an LQIP blur placeholder. Original is retained.
- A-04 **Alt text is required** to publish, pre-filled with a sensible default from the title.
- A-05 **Arrange view:** drag to reorder artworks in the gallery, and images within an
  artwork. Touch-first, large hit areas, autosave indicator. The headline admin feature.
- A-06 Set featured / set hero image from the same view.
- A-07 Delete = **archive** (soft delete), with hard delete available afterwards. Archived
  work stays reachable at its URL.
- A-08 **Listing editor:** paste an Etsy URL, add a label and an indicative price, set
  availability. URL is validated as a well-formed `etsy.com` listing link on save.
- A-09 Draft → publish. Drafts are unreachable publicly, including by direct URL.
- A-10 Editing content triggers on-demand revalidation so the public site updates within
  seconds without a redeploy.
- A-11 **Link health check:** a dashboard panel flagging listings whose Etsy URL last
  returned a non-200, so dead links surface before a customer finds them (§9).
- A-12 The whole admin must be usable one-handed on a phone.

## 9. The Etsy link layer

The one genuinely awkward part of this design: **two systems hold the truth about the
same product, and they will drift.** Etsy listings expire after four months, sell out,
get relisted at new URLs, and change price. Our site will not notice.

Mitigations, cheapest first:

- **E-01** Etsy is stated as the source of truth for price and availability (P-05). Our
  price is a hook to drive the click, not a promise.
- **E-02** A scheduled job (daily, on the free tier's cron) HEAD-requests every listing URL
  and records the status. Non-200s surface in the admin (A-11) and email the artist weekly
  if anything is broken. Cheap, no API key, catches the common failure.
- **E-03** Artist workflow: when relisting on Etsy, update the link here. Documented in a
  one-page guide handed over at launch.
- **E-04** _Deferred:_ the Etsy Open API v3 can sync price, stock and status properly. It
  needs app registration and approval, and OAuth token refresh — real ongoing maintenance
  for a sub-50-item catalogue. Revisit only if manual drift becomes a genuine nuisance.

**E-05** Never deep-link into an Etsy listing that has been deleted. If the health check
has flagged a URL as dead, the buy button degrades to a link to the Etsy shop front rather
than sending the customer to a 404.

## 10. Legal & compliance

Dramatically lighter than a self-hosted shop, because we are not the seller.

- L-01 **We are not a trader in the transaction.** Etsy handles consumer rights, the 14-day
  cancellation right, digital-delivery consent, refunds and disputes. We must not publish
  our own returns or shipping terms that could contradict Etsy's (P-10).
- L-02 **No VAT question for us.** No sale occurs on our domain. Etsy handles VAT and any
  EU digital-goods obligations.
- L-03 Privacy notice covering the contact form and analytics as the only data we touch.
- L-04 Cookie banner **not** required, provided we ship no non-essential cookies — so use a
  cookieless analytics tool and keep it that way.
- L-05 Affiliate/advertising disclosure is not applicable — these are the artist's own
  listings, not affiliate links.

## 11. Technical architecture

With commerce gone, the site is close to static. The database exists only so the artist
can arrange her own gallery.

| Layer          | Choice                                       | Why                                                                     |
| -------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript + Tailwind | Matches CLAUDE.md conventions; static pages with on-demand revalidation |
| Hosting        | Cloudflare Workers/Pages                     | Free tier permits commercial use; generous limits                       |
| Database       | Cloudflare D1 (SQLite) + Drizzle ORM         | Free, same platform, no second vendor. Data is tiny                     |
| Object storage | Cloudflare R2                                | 10GB free and **zero egress fees** — decisive for an image-heavy site   |
| Email          | Resend                                       | Free tier; magic-link login, contact form, broken-link alerts           |
| Admin auth     | Magic link to one allowlisted address        | No auth SaaS, no password to leak                                       |
| Analytics      | Cloudflare Web Analytics                     | Free, cookieless — keeps L-04 true                                      |
| Link health    | Cloudflare Cron Trigger                      | Free, runs E-02 daily                                                   |

**On hosting — DECIDED (v0.3): Cloudflare free tier.** Removing checkout does not make this
site non-commercial — it promotes a business, which is what Vercel's Hobby terms are about.
Cloudflare's free tier permits commercial use outright, so it is correct regardless of
whether we sell on-site, and it keeps hosting, database, storage, analytics and cron with
one vendor on one bill of £0. Vercel Pro (~£16/month) was the considered alternative and
was declined.

**Architectural invariants**

- All secrets server-side. No payment credentials exist anywhere in this system.
- Every mutating route is authenticated and CSRF-protected.
- Public pages are statically generated and revalidated on publish. Only the admin is dynamic.
- Images served as AVIF/WebP at breakpoint-appropriate sizes, with an LQIP placeholder.
- Outbound Etsy links always carry `rel="noopener noreferrer"` and open in a new tab.

## 12. Non-functional requirements

- N-01 Mobile LCP < 2.0s on simulated 4G; Lighthouse Performance ≥ 90 on the artwork page.
- N-02 WCAG 2.2 AA: keyboard-navigable lightbox, visible focus, 4.5:1 text contrast,
  meaningful alt text on every image, and buy buttons that announce they open a new tab.
- N-03 SEO: per-artwork OG images, `VisualArtwork` JSON-LD, sitemap.xml, robots.txt,
  canonical URLs. **No `Product`/`Offer` markup — we don't sell, and claiming an offer we
  can't fulfil risks a structured-data penalty.**
- N-04 No on-call. A site outage costs nothing but traffic; no orders can be lost because
  none are held here.
- N-05 Backups: nightly D1 export to R2, 30-day retention. Images already live in R2.
- N-06 Error monitoring on the admin and upload routes, alerting to email.
- N-07 Lint and tests pass with zero warnings before any commit (per CLAUDE.md).

## 13. Cost model

**Infrastructure**, monthly, GBP:

| Item                                                                   | Cost          |
| ---------------------------------------------------------------------- | ------------- |
| Domain                                                                 | ~£1 (£12/yr)  |
| Hosting, database, storage, analytics, cron (all Cloudflare free tier) | £0            |
| Email (Resend free tier)                                               | £0            |
| **Fixed total**                                                        | **~£1/month** |

**Per-sale**, and this is the real cost of the Etsy decision:

|                    | Etsy                                                       | Self-hosted Stripe |
| ------------------ | ---------------------------------------------------------- | ------------------ |
| Headline fees      | 6.5% transaction + ~4% + 20p processing + ~0.3% regulatory | 1.5% + 20p         |
| Listing fee        | ~$0.20 per listing, every 4 months or per sale             | —                  |
| Offsite Ads        | 12–15% when it applies                                     | —                  |
| **On a £60 print** | **~£6.80**                                                 | **~£1.10**         |

Roughly **9% of revenue**, or about £28/month at five prints a month and £170/month at
thirty. Against that: the entire commerce phase of the build disappears, along with its
ongoing maintenance and liability. At current expected volume the trade is sound. If
monthly print sales pass roughly 30, revisit §17. _Verify Etsy's current fee schedule —
it changes._

## 14. Delivery plan

Roughly half the original scope; the two commerce phases are gone entirely.

| Phase | Scope                                                                                       | Done when                                          |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 0     | Repo, Next.js + TS + Tailwind, design tokens, lint/test CI, deploy pipeline, staging domain | A styled placeholder is live                       |
| 1     | Public site against seeded data: home, work index, artwork page, lightbox, static pages     | Artist can review the real design with real images |
| 2     | Admin: magic-link auth, upload to R2, artwork CRUD, **drag-to-arrange**, publish/archive    | Artist manages the whole catalogue herself         |
| 3     | Listings: Etsy URL editor, buy panel, sold states, outbound click tracking                  | Every artwork reaches the right Etsy page          |
| 4     | Link health cron, alerts, SEO, a11y, analytics, monitoring, backups, privacy page           | Launch checklist green                             |
| 5     | Real content load, DNS cutover, artist handover guide                                       | Live                                               |

Phases 1 and 2 are the ones worth showing the artist early — they determine whether she
actually enjoys using this.

## 15. Open questions

1. ~~**Does the artist already have an Etsy shop?**~~ **Resolved (v0.3):** she is creating
   one now. Listing the work remains her task and is the prerequisite for Phase 3 — Phases
   0 to 2 do not depend on it, so the build can start immediately and in parallel.
2. **Artist's name, brand and domain.** Is the domain registered? Existing brand assets,
   fonts, or a visual reference she likes?
3. **How many listings, and how often do they change?** This determines whether the manual
   link approach (E-03) is comfortable or annoying.
4. **Show prices on our site, or not at all?** Showing them lifts click-through but creates
   the drift problem. Recommend showing, labelled as indicative.
5. **Digital downloads on Etsy** — confirm she's happy with Etsy's auto-delivery and its
   licence wording, since that was a reason to build our own.
6. **Mailing list** — Etsy keeps the customer relationship. Is an owned list wanted at
   launch, or genuinely deferrable?
7. **Launch date**, and is there a show or drop it needs to land before?

## 16. Risks

| Risk                                              | Mitigation                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Etsy links rot — expired, relisted, sold out      | Daily health check + admin flag + weekly digest (E-02); dead links degrade to the shop front (E-05) |
| Price on our site contradicts Etsy                | Etsy stated as source of truth (P-05); prices labelled indicative                                   |
| Customers lost at the handoff                     | Track outbound clicks (P-11) so the drop-off is measurable rather than assumed                      |
| Etsy suspends the shop or raises fees             | Site is unaffected structurally; §17 is the exit route, and the data model already supports it      |
| We own no customer relationship                   | Accepted for v1; owned mailing list is the mitigation (P-12)                                        |
| Artist uploads 60MB files on mobile data          | Client-side downscale, size cap, clear progress UI (A-02)                                           |
| Artist finds the admin awkward and stops using it | Phase 2 ships early for real hands-on feedback                                                      |

## 17. Reversibility — bringing checkout in-house later

Worth stating, because §13 shows this decision has a price that scales with success.

The `Listing` model already carries kind, label and price. Adding on-site checkout means:
add `price_pence` as authoritative, `edition_size`/`edition_sold`, and `shipping_class`;
add `Order`, `OrderItem`, `Reservation` and `DownloadGrant` tables; add Stripe Checkout
plus a webhook handler; and add the UK consumer-rights consent flow for digital goods.

Nothing in this brief needs unpicking to do that — the public site, admin, uploads and
arrange view are all unaffected. It is roughly the two phases removed from v0.1, and the
trigger is volume: at ~30 prints a month the fee saving covers the build within a year.
