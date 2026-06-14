import { describe, it, expect } from "vitest";
import {
  localDayKey,
  addDays,
  densifyDays,
  emptyDay,
  type DailyBucket,
} from "@shared/stats";
import { formatDayShort, formatDayLong } from "@shared/format";

// Build instants from LOCAL components at noon, so the local calendar day is unambiguous in any
// timezone (DST transitions never happen at noon). Month is 0-indexed: 5 = June.
const noon = (y: number, m: number, d: number): number =>
  new Date(y, m - 1, d, 12, 0, 0).getTime();

describe("localDayKey", () => {
  it("formats a local instant as a zero-padded YYYY-MM-DD", () => {
    expect(localDayKey(noon(2026, 6, 14))).toBe("2026-06-14");
    expect(localDayKey(noon(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("walks forward and back, crossing month and year ends", () => {
    expect(addDays("2026-06-14", 1)).toBe("2026-06-15");
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-06-14", 0)).toBe("2026-06-14");
  });
});

describe("densifyDays", () => {
  const bucket = (day: string, input: number): DailyBucket => ({
    ...emptyDay(day),
    inputTokens: input,
  });

  it("fills every missing day in the range with a zero bucket", () => {
    const out = densifyDays([], "2026-06-12", "2026-06-14");
    expect(out.map((b) => b.day)).toEqual([
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ]);
    expect(out.every((b) => b.inputTokens === 0)).toBe(true);
  });

  it("keeps the sparse buckets and zero-fills the gaps, ascending", () => {
    const out = densifyDays(
      [bucket("2026-06-13", 7)],
      "2026-06-12",
      "2026-06-14",
    );
    expect(out.map((b) => [b.day, b.inputTokens])).toEqual([
      ["2026-06-12", 0],
      ["2026-06-13", 7],
      ["2026-06-14", 0],
    ]);
  });

  it("drops buckets outside the range and returns [] when start is after end", () => {
    const out = densifyDays(
      [bucket("2026-06-10", 1), bucket("2026-06-13", 2)],
      "2026-06-12",
      "2026-06-13",
    );
    expect(out.map((b) => b.day)).toEqual(["2026-06-12", "2026-06-13"]);
    expect(densifyDays([], "2026-06-15", "2026-06-14")).toEqual([]);
  });

  it("returns a single day when start equals end", () => {
    expect(
      densifyDays([], "2026-06-14", "2026-06-14").map((b) => b.day),
    ).toEqual(["2026-06-14"]);
  });
});

describe("formatDayShort / formatDayLong", () => {
  it("renders a day key as a short axis label", () => {
    expect(formatDayShort("2026-06-14")).toBe("Jun 14");
    expect(formatDayShort("2026-01-05")).toBe("Jan 5");
  });

  it("renders a day key with the year for the tooltip", () => {
    expect(formatDayLong("2026-06-14")).toBe("Jun 14, 2026");
    expect(formatDayLong("2026-12-01")).toBe("Dec 1, 2026");
  });
});
