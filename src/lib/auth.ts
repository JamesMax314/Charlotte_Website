import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Single-user passphrase auth.
 *
 * Deliberately not PBKDF2/Argon2. Cloudflare's Workers free tier allows ~10ms
 * CPU per request, and a proper slow hash blows straight through it. Slow
 * hashing exists to protect *low-entropy human-chosen* passwords from offline
 * cracking; here the passphrase is machine-generated with ~120 bits of entropy
 * by `pnpm admin:passphrase`, which cannot be brute forced at any hash speed.
 *
 * The invariant that makes this safe: the passphrase MUST be the generated one.
 * Never accept a human-chosen passphrase into ADMIN_PASSPHRASE_HASH.
 */

export const SESSION_COOKIE = "charlotte_admin";
const SESSION_DAYS = 30;

const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** Compares in constant time so a mismatch position never leaks via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toBase64(new Uint8Array(digest));
}

/** Stored form: `sha256$<salt>$<digest>`. */
export async function hashPassphrase(passphrase: string, salt: string): Promise<string> {
  return `sha256$${salt}$${await sha256(`${salt}:${passphrase}`)}`;
}

export async function verifyPassphrase(passphrase: string, stored: string): Promise<boolean> {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "sha256" || !salt || !digest) return false;
  const candidate = await sha256(`${salt}:${passphrase}`);
  return timingSafeEqual(candidate, digest);
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toBase64(new Uint8Array(signature));
}

type Env = { ADMIN_PASSPHRASE_HASH?: string; SESSION_SECRET?: string };

async function secrets(): Promise<Env> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as Env;
}

/**
 * Signs `<expiry>.<hmac>`. A bearer token with no server-side revocation list —
 * rotating SESSION_SECRET invalidates every session at once, which is the
 * intended panic button for a single-user admin.
 */
export async function createSessionValue(): Promise<{ value: string; expires: Date }> {
  const { SESSION_SECRET } = await secrets();
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not configured");

  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const signature = await hmac(SESSION_SECRET, String(expiresAt));
  return { value: `${expiresAt}.${signature}`, expires: new Date(expiresAt) };
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const separator = value.indexOf(".");
  if (separator === -1) return false;

  const expiresAt = Number(value.slice(0, separator));
  const signature = value.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const { SESSION_SECRET } = await secrets();
  if (!SESSION_SECRET) return false;

  return timingSafeEqual(await hmac(SESSION_SECRET, String(expiresAt)), signature);
}

export async function hasValidSession(): Promise<boolean> {
  const store = await cookies();
  return isValidSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Gate for admin pages, server actions and route handlers.
 *
 * Server actions are routed independently of layouts, so a layout check alone
 * protects nothing. Every mutating entry point must call this itself.
 */
export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) redirect("/admin/login");
}

export async function checkPassphrase(passphrase: string): Promise<boolean> {
  const { ADMIN_PASSPHRASE_HASH } = await secrets();
  if (!ADMIN_PASSPHRASE_HASH) return false;
  return verifyPassphrase(passphrase, ADMIN_PASSPHRASE_HASH);
}
