import { describe, it, expect } from "vitest";
import {
  niceAxisMax,
  axisTicks,
  stackBands,
} from "../../src/renderer/src/ui/charts-geom";

describe("niceAxisMax", () => {
  it("rounds a positive max up to the nearest 1/2/5 x 10^n", () => {
    expect(niceAxisMax(1)).toBe(1);
    expect(niceAxisMax(1.5)).toBe(2);
    expect(niceAxisMax(7)).toBe(10);
    expect(niceAxisMax(450)).toBe(500);
    expect(niceAxisMax(1_500_000)).toBe(2_000_000);
    expect(niceAxisMax(2_000_000)).toBe(2_000_000);
    expect(niceAxisMax(2_100_000)).toBe(5_000_000);
  });

  it("yields 1 for a zero or negative max, so an all-zero range still draws an axis", () => {
    expect(niceAxisMax(0)).toBe(1);
    expect(niceAxisMax(-5)).toBe(1);
  });
});

describe("axisTicks", () => {
  it("splits the axis into count+1 evenly spaced, ascending tick values", () => {
    expect(axisTicks(2_000_000)).toEqual([
      0, 500_000, 1_000_000, 1_500_000, 2_000_000,
    ]);
    expect(axisTicks(2_000_000, 2)).toEqual([0, 1_000_000, 2_000_000]);
  });

  it("returns [0] for a zero or negative axis", () => {
    expect(axisTicks(0)).toEqual([0]);
    expect(axisTicks(-1)).toEqual([0]);
  });

  it("collapses duplicate ticks integer rounding produces on a small axis", () => {
    expect(axisTicks(1)).toEqual([0, 1]);
  });
});

describe("stackBands", () => {
  it("stacks values bottom-up as fractions of the axis max", () => {
    expect(stackBands([1, 3], ["A", "B"], 4)).toEqual([
      { color: "A", y0: 0, y1: 0.25 },
      { color: "B", y0: 0.25, y1: 1 },
    ]);
  });

  it("places a single value against the axis, not its own sum", () => {
    expect(stackBands([2], ["A"], 4)).toEqual([{ color: "A", y0: 0, y1: 0.5 }]);
  });

  it("gives every band zero height when the axis max is zero", () => {
    expect(stackBands([1, 1], ["A", "B"], 0)).toEqual([
      { color: "A", y0: 0, y1: 0 },
      { color: "B", y0: 0, y1: 0 },
    ]);
  });

  it("returns [] for no values", () => {
    expect(stackBands([], [], 4)).toEqual([]);
  });
});
