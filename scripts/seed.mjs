/**
 * Loads the development catalogue into local D1 and R2.
 *
 * Development convenience only — production content comes from the admin. Safe
 * to re-run: it clears the tables first and object keys are content hashed.
 *
 *   pnpm seed
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SEED_DIR = "public/seed";
const ETSY = "https://www.etsy.com/uk/shop/CharlotteMakes";
const url = (id) => `${ETSY}?listing=${id}`;
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);

const ARTWORKS = [
  {
    slug: "harbour-wall",
    title: "Harbour Wall",
    year: 2026,
    medium: "Ink and gouache on paper",
    dimensions: "Original 42 × 52 cm",
    status: "published",
    featured: true,
    description:
      "Drawn from the end of the west pier on a cold morning, when the tide was low enough to walk out to the steps.",
    file: "harbour-wall.png",
    alt: "Ink drawing of a harbour wall with a blue form behind loose black contour lines",
    listings: [
      {
        kind: "print",
        label: "A2 giclée print",
        etsy: url("1401"),
        price: 6500,
        availability: "available",
        size: 25,
        remaining: 18,
      },
      {
        kind: "digital",
        label: "Digital download",
        etsy: url("1402"),
        price: 1200,
        availability: "available",
      },
    ],
  },
  {
    slug: "two-figures-walking",
    title: "Two Figures Walking",
    year: 2026,
    medium: "Brush pen on cartridge paper",
    dimensions: "Original 40 × 40 cm",
    status: "published",
    featured: true,
    description: "One line, not lifted. The second figure arrived by accident and stayed.",
    file: "two-figures-walking.png",
    alt: "Square brush-pen drawing of two overlapping walking figures in black line",
    listings: [
      {
        kind: "print",
        label: "A3 giclée print",
        etsy: url("1403"),
        price: 4500,
        availability: "available",
        size: 40,
        remaining: 31,
      },
    ],
  },
  {
    slug: "the-long-field",
    title: "The Long Field",
    year: 2025,
    medium: "Screenprint, two colours",
    dimensions: "Original 60 × 40 cm",
    status: "published",
    featured: true,
    description:
      "Printed over two afternoons. The blue went down first and had to dry overnight before the black.",
    file: "the-long-field.png",
    alt: "Landscape two-colour screenprint of a field, blue block beneath black line work",
    listings: [
      {
        kind: "print",
        label: "A2 giclée print",
        etsy: url("1404"),
        price: 7000,
        availability: "available",
        size: 20,
        remaining: 4,
      },
      {
        kind: "digital",
        label: "Digital download",
        etsy: url("1405"),
        price: 1200,
        availability: "available",
      },
    ],
  },
  {
    slug: "kitchen-window",
    title: "Kitchen Window",
    year: 2025,
    medium: "Ink on paper",
    dimensions: "Original 30 × 40 cm",
    status: "published",
    featured: false,
    description:
      "The same window, drawn most mornings for a fortnight. This is the one that worked.",
    file: "kitchen-window.png",
    alt: "Tall ink drawing of a kitchen window with a warm grey block and black contour lines",
    listings: [
      {
        kind: "print",
        label: "A3 giclée print",
        etsy: url("1406"),
        price: 4500,
        availability: "sold_out",
        size: 30,
        remaining: 0,
      },
    ],
  },
  {
    slug: "orchard-in-may",
    title: "Orchard in May",
    year: 2025,
    medium: "Ink and gouache on paper",
    dimensions: "Original 42 × 52 cm",
    status: "published",
    featured: false,
    description: "Everything was blossom that week and none of it held still.",
    file: "orchard-in-may.png",
    alt: "Ink and gouache drawing of an orchard, warm grey shape behind dense black lines",
    listings: [
      {
        kind: "print",
        label: "A3 giclée print",
        etsy: url("1407"),
        price: 4500,
        availability: "available",
        size: 40,
        remaining: 22,
      },
    ],
  },
  {
    slug: "swimmers",
    title: "Swimmers",
    year: 2024,
    medium: "Brush pen on cartridge paper",
    dimensions: "Original 42 × 52 cm",
    status: "published",
    featured: false,
    description: "Sold as an original. Not currently available as a print.",
    file: "swimmers.png",
    alt: "Brush-pen drawing of swimmers rendered in overlapping black contour lines",
    listings: [],
  },
  {
    slug: "night-bus",
    title: "Night Bus",
    year: 2024,
    medium: "Screenprint, two colours",
    dimensions: "Original 60 × 40 cm",
    status: "archived",
    featured: false,
    description: "A sold-out edition from 2024, kept here because people still ask about it.",
    file: "night-bus.png",
    alt: "Landscape screenprint of a night bus interior, blue block with black line work",
    listings: [
      {
        kind: "print",
        label: "A2 giclée print",
        etsy: url("1408"),
        price: 7000,
        availability: "sold_out",
        size: 15,
        remaining: 0,
      },
    ],
  },
  {
    slug: "her-mothers-coat",
    title: "Her Mother's Coat",
    year: 2026,
    medium: "Ink on paper",
    dimensions: null,
    status: "draft",
    featured: false,
    description: "Unfinished.",
    file: "her-mothers-coat.png",
    alt: "Ink drawing of a coat hanging, loose black contour lines",
    listings: [],
  },
];

/** PNG dimensions live in the IHDR chunk, bytes 16..24. */
function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const wrangler = (args) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SSL_CERT_FILE: undefined, WRANGLER_SEND_METRICS: "false", CI: "1" },
  });

const present = new Set(readdirSync(SEED_DIR));
const statements = [
  "DELETE FROM listings;",
  "DELETE FROM artwork_images;",
  "DELETE FROM artworks;",
  "DELETE FROM site_settings;",
  `INSERT INTO site_settings (id, etsy_shop_url, contact_email, instagram_url) VALUES (1, ${q(ETSY)}, ${q("hello@example.com")}, ${q("https://www.instagram.com/")});`,
];

ARTWORKS.forEach((a, i) => {
  if (!present.has(a.file)) throw new Error(`Missing seed image ${a.file}`);
  const bytes = readFileSync(path.join(SEED_DIR, a.file));
  const { width, height } = pngSize(bytes);
  const key = `artworks/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.png`;

  process.stdout.write(`  ${a.slug} → ${key} (${width}×${height})\n`);
  wrangler([
    "r2",
    "object",
    "put",
    `charlotte-website-media/${key}`,
    `--file=${path.join(SEED_DIR, a.file)}`,
    "--content-type=image/png",
    "--local",
  ]);

  const id = `seed-${a.slug}`;
  statements.push(
    `INSERT INTO artworks (id, slug, title, year, medium, dimensions_note, description, status, sort_order, is_featured, created_at, updated_at) VALUES (${q(id)}, ${q(a.slug)}, ${q(a.title)}, ${a.year}, ${q(a.medium)}, ${q(a.dimensions)}, ${q(a.description)}, ${q(a.status)}, ${i + 1}, ${a.featured ? 1 : 0}, ${Date.now()}, ${Date.now()});`,
    `INSERT INTO artwork_images (id, artwork_id, storage_key, alt, width, height, lqip, sort_order) VALUES (${q(id + "-img")}, ${q(id)}, ${q(key)}, ${q(a.alt)}, ${width}, ${height}, NULL, 0);`,
  );
  a.listings.forEach((l, j) => {
    statements.push(
      `INSERT INTO listings (id, artwork_id, kind, label, etsy_url, price_pence, availability, edition_size, edition_remaining, sort_order) VALUES (${q(`${id}-l${j}`)}, ${q(id)}, ${q(l.kind)}, ${q(l.label)}, ${q(l.etsy)}, ${l.price}, ${q(l.availability)}, ${l.size ?? "NULL"}, ${l.remaining ?? "NULL"}, ${j});`,
    );
  });
});

writeFileSync("/tmp/seed.sql", statements.join("\n"));
wrangler(["d1", "execute", "charlotte-website", "--local", "--file=/tmp/seed.sql"]);
console.log(`\nSeeded ${ARTWORKS.length} artworks into local D1 and R2.`);
