import { describe, it, vi, beforeEach } from "vitest";
// @types/node is pinned to v20 project-wide; node:sqlite's declarations only
// arrived in v22.5's. The module itself is real at runtime (Node 22+, and
// this repo's dev/CI Node is newer), just untyped here.
// @ts-expect-error -- no declarations for node:sqlite under @types/node ^20
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * `pasteWallSelection` and `restoreBackup` against a real SQLite engine,
 * with D1's own bound-parameter cap enforced by the fake driver below.
 *
 * Every other test in this codebase that touches the database fakes D1 by
 * recording the SQL it was sent (see `portfolio-deletes.test.ts`) — enough to
 * check statement order, not enough to catch a query D1 itself would refuse.
 * That gap is exactly what let a real bug through: pasting a piece whose own
 * page holds a modest gallery of images produces a multi-row
 * `INSERT ... VALUES (...), (...), ...` with one bound parameter per column
 * per row, and D1 caps a single statement at 100
 * (https://developers.cloudflare.com/d1/platform/limits/) — a limit plain
 * SQLite does not have. It passed locally and in every unit test, and failed
 * in production as a redacted React error naming neither the query nor the
 * limit. `chunk`/`maxRowsPerInsert` in `src/lib/chunk.ts` is the fix; this
 * file is what makes sure it stays fixed.
 *
 * Node's built-in `node:sqlite` gives real INSERT/SELECT/FK semantics without
 * a new dependency; `drizzle-orm/sqlite-proxy` lets the actual server actions
 * run unmodified against it.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireSession: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const migrationsDir = path.resolve(__dirname, "../../../migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** D1's documented ceiling — see src/lib/chunk.ts. */
const D1_MAX_BOUND_PARAMETERS = 100;

async function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const f of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  const { drizzle } = await import("drizzle-orm/sqlite-proxy");
  const schema = await import("@/db/schema");

  const toRows = (rows: Record<string, unknown>[]) => rows.map((row) => Object.values(row));

  const callback = async (sql: string, params: unknown[], method: string) => {
    if (params.length > D1_MAX_BOUND_PARAMETERS) {
      throw new Error(
        `D1_ERROR: too many SQL variables: ${params.length} bound parameters ` +
          `(max ${D1_MAX_BOUND_PARAMETERS})`,
      );
    }
    const stmt = sqlite.prepare(sql);
    if (method === "run") {
      stmt.run(...(params as never[]));
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...(params as never[])) as Record<string, unknown> | undefined;
      return { rows: row ? toRows([row]) : [] };
    }
    const rows = stmt.all(...(params as never[])) as Record<string, unknown>[];
    return { rows: toRows(rows) };
  };

  const batchCallback = async (queries: { sql: string; params: unknown[]; method: string }[]) => {
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const q of queries) results.push(await callback(q.sql, q.params, q.method));
      sqlite.exec("COMMIT");
      return results;
    } catch (cause) {
      sqlite.exec("ROLLBACK");
      throw cause;
    }
  };

  const drizzleDb = drizzle(callback, batchCallback, { schema });
  return { sqlite, drizzleDb };
}

/** A piece with `childCount` elements arranged on its own page. */
const seedPieceWithPage = (
  sqlite: DatabaseSync,
  {
    pieceId,
    targetPageId,
    childCount,
  }: { pieceId: string; targetPageId: string; childCount: number },
) => {
  const now = Date.now();
  sqlite.exec(`
    insert into site_pages (id, slug, title, status, nav_order, created_at, updated_at)
    values ('${targetPageId}', '${targetPageId}', 'Target', 'published', 1, ${now}, ${now});

    insert into portfolio_items
      (id, slug, name, information, status, parent_id, page_id, clickable, zoomable, x, y, width, z, created_at, updated_at)
    values
      ('${pieceId}', '${pieceId}', 'Piece', '', 'published', null, null, 1, 1, 10, 10, 30, 1, ${now}, ${now});
  `);
  for (let i = 0; i < childCount; i++) {
    sqlite.exec(`
      insert into portfolio_items
        (id, slug, name, information, status, parent_id, page_id, clickable, zoomable, x, y, width, z, created_at, updated_at)
      values
        ('${pieceId}-child-${i}', '${pieceId}-child-${i}', 'Child ${i}', '', 'published', '${pieceId}', null, 0, 1, 5, 5, 20, 1, ${now}, ${now});
    `);
  }
};

describe("pasteWallSelection against D1's real limits", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("pastes a plain piece across pages", async () => {
    const { sqlite, drizzleDb } = await makeDb();
    vi.doMock("@/lib/db", () => ({ getDb: async () => drizzleDb }));
    seedPieceWithPage(sqlite, { pieceId: "piece-a", targetPageId: "page-b", childCount: 0 });

    const { pasteWallSelection } = await import("./portfolio-actions");
    const result = await pasteWallSelection(
      { items: ["piece-a"], texts: [] },
      { kind: "page", id: "page-b" },
      { x: 3, y: 3 },
    );
    if (result.items.length !== 1)
      throw new Error("expected one pasted item: " + JSON.stringify(result));
  });

  it("pastes a piece whose own page holds enough elements to exceed D1's 100-bound-parameter cap in one insert", async () => {
    const { sqlite, drizzleDb } = await makeDb();
    vi.doMock("@/lib/db", () => ({ getDb: async () => drizzleDb }));
    // 11 portfolio_items rows (piece + 10 children) at 15 columns each is 165
    // bound parameters — comfortably over the cap in a single insert.
    seedPieceWithPage(sqlite, { pieceId: "piece-a", targetPageId: "page-b", childCount: 10 });

    const { pasteWallSelection } = await import("./portfolio-actions");
    const result = await pasteWallSelection(
      { items: ["piece-a"], texts: [] },
      { kind: "page", id: "page-b" },
      { x: 3, y: 3 },
    );
    if (result.items.length !== 1)
      throw new Error("expected one pasted item: " + JSON.stringify(result));

    const items = sqlite.prepare("select id from portfolio_items").all();
    // 1 original piece + 10 original children + 1 pasted piece + 10 pasted children.
    if (items.length !== 22)
      throw new Error(`expected 22 portfolio_items rows, got ${items.length}`);
  });

  it("restoreBackup restores a family large enough to exceed the cap in one insert", async () => {
    const { sqlite, drizzleDb } = await makeDb();
    vi.doMock("@/lib/db", () => ({ getDb: async () => drizzleDb }));

    const now = new Date();
    const portfolioItems = Array.from({ length: 11 }, (_, i) => ({
      id: `restored-${i}`,
      slug: `restored-${i}`,
      name: `Restored ${i}`,
      information: "",
      status: "published" as const,
      parentId: null,
      pageId: null,
      clickable: true,
      zoomable: true,
      x: 0,
      y: 0,
      width: 20,
      z: 1,
      createdAt: now,
      updatedAt: now,
    }));

    const { restoreBackup } = await import("@/lib/undo-restore");
    await restoreBackup({ portfolio_items: portfolioItems });

    const rows = sqlite.prepare("select id from portfolio_items").all();
    if (rows.length !== 11) throw new Error(`expected 11 restored rows, got ${rows.length}`);
  });
});
