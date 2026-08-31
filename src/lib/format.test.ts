import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("drops decimals for whole pounds", () => {
    expect(formatPrice(4500)).toBe("£45");
  });

  it("keeps decimals when there are pence", () => {
    expect(formatPrice(4550)).toBe("£45.50");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("£0");
  });

  it("formats thousands with a separator", () => {
    expect(formatPrice(120000)).toBe("£1,200");
  });

  it("rejects non-integer pence, which would signal a float creeping in", () => {
    expect(() => formatPrice(45.5)).toThrow(TypeError);
  });
});
