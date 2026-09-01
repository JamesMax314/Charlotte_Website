/**
 * Absolute origin, needed for canonical URLs, sitemaps and OG images.
 *
 * The real domain is the committed default rather than an environment
 * variable, because `.gitignore` covers `.env*`: a value that lives only in a
 * local env file is one that CI and every other machine builds without, and
 * the symptom is every canonical URL on the live site quietly reverting to a
 * placeholder. `NEXT_PUBLIC_SITE_URL` still overrides it, which is what a
 * preview deployment on another origin wants — and being `NEXT_PUBLIC_` it is
 * baked in at build time, so it must be set for the build, never as a Worker
 * variable afterwards.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://charlottewilkinsonart.co.uk";

/** The host `SITE_URL` names, for comparing against the host actually served. */
export const SITE_HOST = new URL(SITE_URL).host;
