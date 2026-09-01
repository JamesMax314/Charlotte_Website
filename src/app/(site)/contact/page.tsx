import { permanentRedirect } from "next/navigation";

/**
 * Contact used to be a page of its own; its words now sit beneath the about
 * copy. The route stays as a redirect rather than being deleted, because the
 * brief's rule is that a URL which has been shared must never 404 (P-08) — and
 * `contact` therefore stays in RESERVED_PAGE_SLUGS, or a custom page could take
 * the name and shadow this.
 *
 * Permanent, so a search engine transfers the ranking to /about rather than
 * indexing both, and to the heading rather than the top of a page whose first
 * screen is about something else.
 */
export default function ContactPage(): never {
  permanentRedirect("/about#contact");
}
