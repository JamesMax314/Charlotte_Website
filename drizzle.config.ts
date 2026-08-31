import type { Config } from "drizzle-kit";

/**
 * Generates plain SQL into migrations/, which `wrangler d1 migrations apply`
 * consumes directly. Drizzle never talks to D1 itself — wrangler owns that,
 * so local and remote use one migration path.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
} satisfies Config;
