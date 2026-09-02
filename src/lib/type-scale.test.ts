import { describe, expect, it } from "vitest";
import { PT_STEPS, ptOptions } from "./type-scale";

describe("PT_STEPS", () => {
  it("is ascending, unique and whole", () => {
    expect(PT_STEPS).toEqual([...new Set(PT_STEPS)]);
    expect([...PT_STEPS].sort((a, b) => a - b)).toEqual([...PT_STEPS]);
    expect(PT_STEPS.every(Number.isInteger)).toBe(true);
  });

  it("offers every point from 5 to 40", () => {
    for (let pt = 5; pt <= 40; pt += 1) expect(PT_STEPS).toContain(pt);
  });

  it("reaches past 40, so the seeded 51pt heading is expressible", () => {
    expect(Math.max(...PT_STEPS)).toBeGreaterThanOrEqual(144);
  });
});

describe("ptOptions", () => {
  it("offers only what the field can reach", () => {
    const options = ptOptions(12, 10, 20);
    expect(options[0]).toBe(10);
    expect(options[options.length - 1]).toBe(20);
  });

  /*
    The rule the whole control rests on. A <select> whose value matches no
    option renders blank, and the stored size is routinely off the ladder —
    the migrated home heading sits at about 51pt.
  */
  it("keeps a size that is not on the ladder, in its place", () => {
    const options = ptOptions(51, 5, 194);
    expect(options).toContain(51);
    expect([...options].sort((a, b) => a - b)).toEqual(options);
  });

  it("does not duplicate a size that is on the ladder", () => {
    const options = ptOptions(24, 5, 194);
    expect(options.filter((pt) => pt === 24)).toHaveLength(1);
  });

  it("keeps a current size that the bounds would otherwise exclude", () => {
    expect(ptOptions(200, 5, 194)).toContain(200);
    expect(ptOptions(3, 5, 194)[0]).toBe(3);
  });
});
