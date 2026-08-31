/**
 * Generates the admin passphrase and its hash.
 *
 * Deliberately does not accept a passphrase you choose. The auth design trades
 * a slow hash for a high-entropy secret (see src/lib/auth.ts), and that trade
 * only holds if the secret is machine-generated.
 *
 *   pnpm admin:passphrase
 */
import { randomBytes, createHash, randomUUID } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
const bytes = randomBytes(24);
const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
const passphrase = chars
  .join("")
  .match(/.{1,4}/g)
  .join("-");

const salt = randomUUID().replaceAll("-", "");
const digest = createHash("sha256").update(`${salt}:${passphrase}`).digest("base64");

console.log(`
Passphrase (give this to the artist — it is shown once):

    ${passphrase}

Store the hash as a secret:

    pnpm exec wrangler secret put ADMIN_PASSPHRASE_HASH
    # paste: sha256$${salt}$${digest}

And a session signing secret:

    pnpm exec wrangler secret put SESSION_SECRET
    # paste: ${randomBytes(32).toString("base64")}

For local development put both in .dev.vars (gitignored):

    ADMIN_PASSPHRASE_HASH="sha256$${salt}$${digest}"
    SESSION_SECRET="${randomBytes(32).toString("base64")}"
`);
