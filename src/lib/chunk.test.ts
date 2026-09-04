import { describe, expect, it } from "vitest";
import { chunk, maxRowsPerInsert } from "./chunk";

describe("chunk", () => {
  it("splits evenly", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("leaves a smaller final group", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns nothing for an empty array", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("returns one group when size exceeds the array length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("rejects a non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
    expect(() => chunk([1], -1)).toThrow();
  });
});

describe("maxRowsPerInsert", () => {
  it("divides D1's cap by the column count", () => {
    expect(maxRowsPerInsert(15)).toBe(6);
    expect(maxRowsPerInsert(19)).toBe(5);
    expect(maxRowsPerInsert(8)).toBe(12);
  });

  it("never returns fewer than one row, even for a very wide table", () => {
    expect(maxRowsPerInsert(500)).toBe(1);
  });
});
