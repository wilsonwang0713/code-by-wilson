import { describe, it, expect } from "vitest";
import {
  rangeSinceMs,
  rangeWindow,
  calendarWindow,
  dayStartMs,
  isDayRange,
  DEFAULT_RANGE,
} from "@shared/stats";

// A fixed local wall-clock instant to anchor the boundary assertions: 14 Jun 2026, 14:30 local.
// new Date(year, monthIndex, day, ...) builds a LOCAL instant (month is 0-indexed → 5 = June), so the
// expected boundaries below are constructed independently of rangeSinceMs's own setHours/setDate path.
const NOON = new Date(2026, 5, 14, 14, 30, 0).getTime();

describe("rangeSinceMs", () => {
  it("defaults the product range to 30d", () => {
    expect(DEFAULT_RANGE).toBe("30d");
  });

  it("returns null for all-time (no lower bound)", () => {
    expect(rangeSinceMs("all", NOON)).toBeNull();
  });

  it("today is the start of the current local day", () => {
    expect(rangeSinceMs("today", NOON)).toBe(
      new Date(2026, 5, 14, 0, 0, 0, 0).getTime(),
    );
  });

  it("7d starts six local days before today (seven inclusive days)", () => {
    expect(rangeSinceMs("7d", NOON)).toBe(
      new Date(2026, 5, 8, 0, 0, 0, 0).getTime(),
    );
  });

  it("30d starts twenty-nine local days before today", () => {
    expect(rangeSinceMs("30d", NOON)).toBe(
      new Date(2026, 4, 16, 0, 0, 0, 0).getTime(),
    );
  });

  it("90d starts eighty-nine local days before today", () => {
    expect(rangeSinceMs("90d", NOON)).toBe(
      new Date(2026, 2, 17, 0, 0, 0, 0).getTime(),
    );
  });

  it("snaps to local midnight regardless of the time of day", () => {
    const lateNight = new Date(2026, 5, 14, 23, 59, 59, 999).getTime();
    const ms = rangeSinceMs("today", lateNight)!;
    const d = new Date(ms);
    expect([
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);
    expect(ms).toBeLessThanOrEqual(lateNight);
  });
});

describe("dayStartMs", () => {
  it("is local midnight for a 'YYYY-MM-DD' key", () => {
    expect(dayStartMs("2026-06-14")).toBe(
      new Date(2026, 5, 14, 0, 0, 0, 0).getTime(),
    );
  });

  it("crosses the year boundary via the local-Date parts (no off-by-one month)", () => {
    expect(dayStartMs("2025-01-01")).toBe(new Date(2025, 0, 1).getTime());
    expect(dayStartMs("2024-12-31")).toBe(new Date(2024, 11, 31).getTime());
  });
});

describe("isDayRange", () => {
  it("is true only for the single-day variant", () => {
    expect(isDayRange("30d")).toBe(false);
    expect(isDayRange("all")).toBe(false);
    expect(isDayRange({ day: "2026-06-14" })).toBe(true);
  });
});

describe("rangeWindow", () => {
  it("turns a preset into an open-topped window (since only)", () => {
    expect(rangeWindow("30d", NOON)).toEqual({
      sinceMs: new Date(2026, 4, 16, 0, 0, 0, 0).getTime(),
      untilMs: null,
    });
  });

  it("all-time is an unbounded window", () => {
    expect(rangeWindow("all", NOON)).toEqual({ sinceMs: null, untilMs: null });
  });

  it("a preset keeps the upper bound open (today, distinct from a single day)", () => {
    expect(rangeWindow("today", NOON)).toEqual({
      sinceMs: new Date(2026, 5, 14, 0, 0, 0, 0).getTime(),
      untilMs: null,
    });
  });

  it("a single day is bounded both ends: [midnight, next midnight)", () => {
    expect(rangeWindow({ day: "2026-06-14" }, NOON)).toEqual({
      sinceMs: new Date(2026, 5, 14, 0, 0, 0, 0).getTime(),
      untilMs: new Date(2026, 5, 15, 0, 0, 0, 0).getTime(),
    });
  });
});

describe("calendarWindow", () => {
  it("trailing (null year) ends today and spans 365 inclusive local days", () => {
    expect(calendarWindow(null, NOON)).toEqual({
      startDay: "2025-06-15",
      endDay: "2026-06-14",
      sinceMs: new Date(2025, 5, 15, 0, 0, 0, 0).getTime(),
      untilMs: new Date(2026, 5, 15, 0, 0, 0, 0).getTime(),
    });
  });

  it("a specific (past) year spans Jan 1 through Dec 31 of that year", () => {
    expect(calendarWindow(2024, NOON)).toEqual({
      startDay: "2024-01-01",
      endDay: "2024-12-31",
      sinceMs: new Date(2024, 0, 1, 0, 0, 0, 0).getTime(),
      untilMs: new Date(2025, 0, 1, 0, 0, 0, 0).getTime(),
    });
  });

  it("clamps the current year to today, never padding empty future months", () => {
    expect(calendarWindow(2026, NOON)).toEqual({
      startDay: "2026-01-01",
      endDay: "2026-06-14",
      sinceMs: new Date(2026, 0, 1, 0, 0, 0, 0).getTime(),
      untilMs: new Date(2026, 5, 15, 0, 0, 0, 0).getTime(),
    });
  });
});
