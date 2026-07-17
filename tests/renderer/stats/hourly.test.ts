import { describe, it, expect } from "vitest";
import {
  foldHourly,
  maxHourlyTurns,
} from "../../../src/renderer/src/stats/hourly";
import type { HourDowCell } from "../../../src/shared/stats";

const cell = (dow: number, hour: number, turns: number): HourDowCell => ({
  dow,
  hour,
  turns,
});

describe("foldHourly", () => {
  it("densifies the full 24×7 grid with zero fill", () => {
    const cols = foldHourly([]);
    expect(cols).toHaveLength(24);
    expect(cols.every((c) => c.bins.length === 7)).toBe(true);
    expect(cols.every((c) => c.bins.every((b) => b.count === 0))).toBe(true);
  });

  it("places sparse cells at (hour column, weekday row)", () => {
    const cols = foldHourly([cell(3, 14, 42)]); // Wednesday 14:00
    expect(cols[14].bin).toBe(14);
    expect(cols[14].bins[3].count).toBe(42);
    expect(cols[14].bins[2].count).toBe(0);
  });

  it("encodes weekday+hour into the synthetic bin date for the tooltip", () => {
    const cols = foldHourly([cell(5, 9, 1)]); // Friday 09:00
    const d = cols[9].bins[5].date;
    expect(d.getDay()).toBe(5);
    expect(d.getHours()).toBe(9);
  });
});

describe("maxHourlyTurns", () => {
  it("finds the busiest cell", () => {
    expect(maxHourlyTurns([cell(0, 0, 3), cell(1, 1, 9), cell(2, 2, 5)])).toBe(
      9,
    );
  });
  it("is zero for an empty matrix", () => {
    expect(maxHourlyTurns([])).toBe(0);
  });
});
