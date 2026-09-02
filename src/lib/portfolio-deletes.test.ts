import { describe, expect, it, vi } from "vitest";

// The suite runs in jsdom, which `server-only` reads as a client component and
// refuses to load. The guard is doing its job; it just has nothing to guard here.
vi.mock("server-only", () => ({}));

/**
 * The database does not cascade `parent_id`, so `deletePiecesWithPages` has to.
 *
 * This is worth a test precisely because the schema *claims* it does: anyone
 * reading src/db/schema.ts sees `onDelete: "cascade"` and would be right to
 * delete the two child statements as redundant. They are not, and D1 cannot be
 * given the clause — see the invariant in docs/progress.md. What follows is a
 * fake D1 client, because the failure this guards is which statements are sent,
 * not what SQLite does with them.
 */

type Recorded = { sql: string; params: unknown[] };

const fakeD1 = (recorded: Recorded[]) => {
  const statement = (sql: string) => ({
    sql,
    bind: (...params: unknown[]) => ({ sql, params }),
  });

  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Recorded[]) => {
      // Drizzle binds before handing the batch over, so what arrives here is
      // the finished statement in the order it will run.
      recorded.push(...statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })));
      return statements.map(() => ({ success: true, results: [], meta: {} }));
    },
  };
};

const load = async (recorded: Recorded[]) => {
  vi.resetModules();
  const { drizzle } = await import("drizzle-orm/d1");
  const schema = await import("@/db/schema");

  vi.doMock("./db", () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDb: async () => drizzle(fakeD1(recorded) as any, { schema }),
  }));

  return (await import("./portfolio-deletes")).deletePiecesWithPages;
};

describe("deletePiecesWithPages", () => {
  it("deletes a piece's own page contents before the piece itself", async () => {
    const recorded: Recorded[] = [];
    const deletePiecesWithPages = await load(recorded);

    await deletePiecesWithPages(["tractor"]);

    expect(recorded).toHaveLength(3);

    // Text on the piece's page, then the pieces on it, then the piece. Any
    // other order asks SQLite to remove a row that is still referenced.
    expect(recorded[0].sql).toMatch(/delete from "wall_texts"[\s\S]*"parent_id"/i);
    expect(recorded[1].sql).toMatch(/delete from "portfolio_items"[\s\S]*"parent_id"/i);
    expect(recorded[2].sql).toMatch(/delete from "portfolio_items"[\s\S]*"id"/i);
    expect(recorded[2].sql).not.toMatch(/parent_id/i);

    for (const statement of recorded) expect(statement.params).toContain("tractor");
  });

  it("carries every selected piece into each statement", async () => {
    const recorded: Recorded[] = [];
    const deletePiecesWithPages = await load(recorded);

    await deletePiecesWithPages(["one", "two"]);

    expect(recorded).toHaveLength(3);
    for (const statement of recorded) {
      expect(statement.params).toEqual(expect.arrayContaining(["one", "two"]));
    }
  });

  /**
   * An empty selection must not reach `db.batch`, which rejects an empty list —
   * and `inArray` with nothing in it is not a delete of nothing in every
   * dialect, so guarding at the top is the honest place for it.
   */
  it("does nothing when given no ids", async () => {
    const recorded: Recorded[] = [];
    const deletePiecesWithPages = await load(recorded);

    await deletePiecesWithPages([]);

    expect(recorded).toHaveLength(0);
  });
});
