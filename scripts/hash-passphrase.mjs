/**
 * Generates the admin passphrase and its hash.
 *
 * Deliberately does not accept a passphrase you choose. The auth design trades
 * a slow hash for a high-entropy secret (see src/lib/auth.ts), and that trade
 * only holds if the secret is machine-generated.
 *
 *   pnpm admin:passphrase          print the passphrase and both secrets
 *   pnpm admin:passphrase --write  also write them straight into .dev.vars
 */
import { randomBytes, createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
const passphrase = Array.from(randomBytes(24), (b) => ALPHABET[b % ALPHABET.length])
  .join("")
  .match(/.{1,4}/g)
  .join("-");

const salt = randomBytes(16).toString("hex");
const hash = `sha256$${salt}$${createHash("sha256").update(`${salt}:${passphrase}`).digest("base64")}`;
const sessionSecret = randomBytes(32).toString("base64");

const write = process.argv.includes("--write");

if (write) {
  if (existsSync(".dev.vars")) {
    const backup = `.dev.vars.backup-${Date.now()}`;
    writeFileSync(backup, (await import("node:fs")).readFileSync(".dev.vars"));
    console.log(`\nExisting .dev.vars backed up to ${backup}`);
  }
  writeFileSync(
    ".dev.vars",
    `ADMIN_PASSPHRASE_HASH="${hash}"\nSESSION_SECRET="${sessionSecret}"\n`,
  );
}

console.log(`
Passphrase — copy this, do not retype it:

    ${passphrase}
`);

if (write) {
  console.log(`Written to .dev.vars. Restart the dev server, then sign in at /admin/login.\n`);
} else {
  console.log(`For local development, write these into .dev.vars (or re-run with --write):

    ADMIN_PASSPHRASE_HASH="${hash}"
    SESSION_SECRET="${sessionSecret}"

To deploy, store the same two values as Cloudflare secrets:

    pnpm exec wrangler secret put ADMIN_PASSPHRASE_HASH
    pnpm exec wrangler secret put SESSION_SECRET
`);
}
