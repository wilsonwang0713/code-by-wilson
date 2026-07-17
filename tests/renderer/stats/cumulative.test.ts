import { describe, it, expect } from "vitest";
import { cumulativeWithProjection } from "../../../src/renderer/src/stats/cumulative";
import { emptyDay } from "../../../src/shared/stats";
import type { DailyBucket } from "../../../src/shared/stats";

function day(key: string, tokens: number): DailyBucket {
  return { ...emptyDay(key), inputTokens: tokens };
}

describe("cumulativeWithProjection", () => {
  it("returns an empty series for no days", () => {
    const s = cumulativeWithProjection([], []);
    expect(s.points).toEqual([]);
    expect(s.lastActualIndex).toBe(-1);
    expect(s.projectedEnd).toBeNull();
  });

  it("accumulates day totals in order", () => {
    const s = cumulativeWithProjection(
      [day("2026-07-01", 100), day("2026-07-02", 50), day("2026-07-03", 25)],
      [],
    );
    expect(s.points.map((p) => p.value)).toEqual([100, 150, 175]);
    expect(s.points.every((p) => !p.projected)).toBe(true);
    expect(s.lastActualIndex).toBe(2);
    expect(s.projectedEnd).toBeNull();
  });

  it("projects future days at the window-average daily rate", () => {
    const s = cumulativeWithProjection(
      [day("2026-07-01", 100), day("2026-07-02", 200)], // avg 150/day
      ["2026-07-03", "2026-07-04"],
    );
    expect(s.points.map((p) => p.value)).toEqual([100, 300, 450, 600]);
    expect(s.points.map((p) => p.projected)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(s.lastActualIndex).toBe(1);
    expect(s.projectedEnd).toBe(600);
  });

  it("counts all four token kinds in the day total", () => {
    const full: DailyBucket = {
      ...emptyDay("2026-07-01"),
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheCreationTokens: 4,
    };
    const s = cumulativeWithProjection([full], []);
    expect(s.points[0].value).toBe(10);
  });

  it("skips projection when the window has no usage (zero rate)", () => {
    const s = cumulativeWithProjection([day("2026-07-01", 0)], ["2026-07-02"]);
    expect(s.projectedEnd).toBeNull();
    expect(s.points).toHaveLength(1);
  });
});
