/**
 * Loads a development catalogue into local D1 and R2.
 *
 * Prefers real artwork in tmp_art/ (gitignored, so it never reaches the public
 * repo) and falls back to the generated placeholders in public/seed/. Safe to
 * re-run: it clears the tables first and object keys are content hashed.
 *
 *   pnpm seed
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const LADDER = [400, 800, 1600, 2400];
const ETSY = "https://www.etsy.com/uk/shop/CharlotteMakes";
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);

/**
 * Descriptions are placeholders written from what is visible in each image.
 * They are not verified credits — the artist should replace them.
 */
const KNOWN = {
  "260313 Peaty Dales Way DL 6pp_PRINT-2.jpg": {
    title: "The Dales Way",
    medium: "Illustrated map, mixed media",
    note: "Interpretive spread, 6pp DL",
    description:
      "An illustrated route map of the Dales Way, with botanical and wildlife studies drawn alongside the peatland restoration story.",
    featured: true,
  },
  "Austwick Amble full image.jpg": {
    title: "Austwick Amble",
    medium: "Collage and digital illustration",
    note: "Full image",
    description:
      "A fell race told as a collaged desk: the runner, the route, checkpoint photographs and the kit that came back muddy.",
    featured: true,
  },
  "LTW archives.jpg": {
    title: "LTW Archives",
    medium: "Collage and digital illustration",
    note: "Editorial spread",
    description:
      "An archive folder opened out — evolution timeline, anatomical study and field notes arranged as if just laid on the desk.",
    featured: true,
  },
  "Tennis serve A4.jpg": {
    title: "Tennis Serve",
    medium: "Digital illustration",
    note: "A4",
    description:
      "The phases of a serve drawn as one continuous motion sequence across the baseline.",
    featured: false,
  },
};

const titleFromFilename = (file) =>
  path
    .basename(file, path.extname(file))
    .replace(/[_-]+/g, " ")
    .replace(/\b(full image|print|final|copy|v\d+|\d{5,})\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Untitled";

const slugify = (v) =>
  v
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sips = (args) => execFileSync("sips", args, { stdio: ["ignore", "pipe", "pipe"] }).toString();

function dimensions(file) {
  const out = sips(["-g", "pixelWidth", "-g", "pixelHeight", file]);
  return {
    width: Number(out.match(/pixelWidth:\s*(\d+)/)[1]),
    height: Number(out.match(/pixelHeight:\s*(\d+)/)[1]),
  };
}

const wrangler = (args) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SSL_CERT_FILE: undefined, WRANGLER_SEND_METRICS: "false", CI: "1" },
  });

const source = existsSync("tmp_art") ? "tmp_art" : "public/seed";
const files = readdirSync(source)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();

if (files.length === 0) throw new Error(`No images found in ${source}`);
console.log(`Seeding from ${source}/ (${files.length} images)\n`);

const work = mkdtempSync(path.join(tmpdir(), "seed-"));
// A staggered starting arrangement so the wall is not a grid on first sight.
// Percentages of canvas width; the artist drags from here.
const LAYOUT = [
  { x: 2, y: 2, width: 46 },
  { x: 54, y: 10, width: 40 },
  { x: 8, y: 44, width: 36 },
  { x: 50, y: 56, width: 44 },
];

const statements = [
  "DELETE FROM listings;",
  "DELETE FROM artwork_images;",
  "DELETE FROM artworks;",
  // Before portfolio_items: wall_texts reference it, and SQLite refuses the
  // delete while a text box on a piece's page still points at the row.
  "DELETE FROM wall_texts;",
  "DELETE FROM portfolio_images;",
  "DELETE FROM portfolio_items;",
  "DELETE FROM site_settings;",
  `INSERT INTO site_settings (id, home_title, home_blurb, etsy_shop_url, contact_email, instagram_url) VALUES (1, ${q("Drawn to explain.")}, ${q("I make illustrated maps, editorial spreads and sequences — drawings that carry information as well as atmosphere.")}, ${q(ETSY)}, ${q("hello@example.com")}, ${q("https://www.instagram.com/")});`,
];

files.forEach((file, index) => {
  const original = path.join(source, file);
  const meta = KNOWN[file] ?? {};
  const title = meta.title ?? titleFromFilename(file);
  const slug = slugify(title);

  // Master capped at the top of the ladder — never ship a 3500px original.
  const master = path.join(work, `${slug}.jpg`);
  sips([
    "-Z",
    String(LADDER[LADDER.length - 1]),
    "--setProperty",
    "formatOptions",
    "86",
    original,
    "--out",
    master,
  ]);
  const { width, height } = dimensions(master);

  const bytes = readFileSync(master);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const key = `artworks/${hash}.jpg`;

  console.log(`  ${title}  ${width}x${height}  → ${key}`);
  wrangler([
    "r2",
    "object",
    "put",
    `charlotte-website-media/${key}`,
    `--file=${master}`,
    "--content-type=image/jpeg",
    "--local",
  ]);

  // The responsive ladder the custom image loader addresses by convention.
  for (const target of LADDER) {
    if (target >= width) continue;
    const variant = path.join(work, `${slug}-${target}.jpg`);
    sips([
      "-Z",
      String(target),
      "--setProperty",
      "formatOptions",
      "82",
      original,
      "--out",
      variant,
    ]);
    wrangler([
      "r2",
      "object",
      "put",
      `charlotte-website-media/artworks/${hash}-${target}.jpg`,
      `--file=${variant}`,
      "--content-type=image/jpeg",
      "--local",
    ]);
  }

  const id = `seed-${slug}`;
  const now = Date.now();

  // The same images also seed the portfolio, which is a separate collection.
  const place = LAYOUT[index % LAYOUT.length];
  const portfolioId = `portfolio-${slug}`;
  statements.push(
    `INSERT INTO portfolio_items (id, slug, name, information, status, x, y, width, z, created_at, updated_at) VALUES (${q(portfolioId)}, ${q(slug)}, ${q(title)}, ${q(meta.description ?? "")}, 'published', ${place.x}, ${place.y}, ${place.width}, ${index + 1}, ${now}, ${now});`,
    `INSERT INTO portfolio_images (id, item_id, storage_key, alt, width, height, lqip, sort_order) VALUES (${q(portfolioId + "-img")}, ${q(portfolioId)}, ${q(key)}, ${q(meta.description ?? title)}, ${width}, ${height}, NULL, 0);`,
  );
  const kind = index % 3 === 2 ? "digital" : "print";
  const pricePence = kind === "digital" ? 1200 + index * 300 : 3500 + index * 1200;
  const label = kind === "digital" ? "High-resolution download" : "A3 giclée print";

  statements.push(
    `INSERT INTO artworks (id, slug, title, year, medium, dimensions_note, description, status, sort_order, is_featured, created_at, updated_at) VALUES (${q(id)}, ${q(slug)}, ${q(title)}, 2026, ${q(meta.medium ?? "Illustration")}, ${q(meta.note ?? null)}, ${q(meta.description ?? "")}, 'published', ${index + 1}, ${meta.featured ? 1 : 0}, ${now}, ${now});`,
    `INSERT INTO artwork_images (id, artwork_id, storage_key, alt, width, height, lqip, sort_order) VALUES (${q(id + "-img")}, ${q(id)}, ${q(key)}, ${q(meta.description ?? title)}, ${width}, ${height}, NULL, 0);`,
    // Prices, formats and one sold-out piece vary across the set so the shop's
    // filters have something to bite on locally.
    `INSERT INTO listings (id, artwork_id, kind, label, etsy_url, price_pence, availability, edition_size, edition_remaining, sort_order) VALUES (${q(id + "-l0")}, ${q(id)}, ${q(kind)}, ${q(label)}, ${q(`${ETSY}?listing=${1400 + index}`)}, ${pricePence}, ${q(index === 2 ? "sold_out" : "available")}, ${kind === "print" ? 40 : "NULL"}, ${kind === "print" ? 30 - index : "NULL"}, 0);`,
  );
});

writeFileSync(path.join(work, "seed.sql"), statements.join("\n"));
wrangler([
  "d1",
  "execute",
  "charlotte-website",
  "--local",
  `--file=${path.join(work, "seed.sql")}`,
]);
console.log(`\nSeeded ${files.length} artworks into local D1 and R2.`);
