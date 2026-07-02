import { describe, it, expect } from "vitest";
import { dutyPct } from "../../src/shared/duty";

describe("dutyPct", () => {
  it("rounds api over wall to a whole percent", () => {
    expect(dutyPct(3_852_000, 12_270_000)).toBe(31);
  });
  it("clamps disagreeing clocks to 100", () => {
    expect(dutyPct(20_000, 10_000)).toBe(100);
  });
  it("is null when either clock is missing", () => {
    expect(dutyPct(null, 10_000)).toBeNull();
    expect(dutyPct(10_000, undefined)).toBeNull();
  });
  it("is null on a zero or negative wall clock", () => {
    expect(dutyPct(1_000, 0)).toBeNull();
    expect(dutyPct(1_000, -5)).toBeNull();
  });
  it("clamps a negative api clock to 0", () => {
    expect(dutyPct(-1, 10_000)).toBe(0);
  });
});
