import { describe, it, expect } from "vitest";
import { equivOf } from "@shared/stats";

describe("equivOf", () => {
  it("returns the all-kinds value when cache is included", () => {
    expect(
      equivOf({ equivApiValueUsd: 36.75, equivApiValueFreshUsd: 30 }, true),
    ).toBe(36.75);
  });

  it("returns the fresh value when cache is excluded", () => {
    expect(
      equivOf({ equivApiValueUsd: 36.75, equivApiValueFreshUsd: 30 }, false),
    ).toBe(30);
  });

  it("passes null through under either toggle (no recognized model)", () => {
    expect(
      equivOf({ equivApiValueUsd: null, equivApiValueFreshUsd: null }, true),
    ).toBeNull();
    expect(
      equivOf({ equivApiValueUsd: null, equivApiValueFreshUsd: null }, false),
    ).toBeNull();
  });
});
