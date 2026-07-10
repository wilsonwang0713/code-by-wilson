import { describe, it, expect } from "vitest";
import {
  nextPumpDelayMs,
  PUMP_BACKFILL_MS,
  PUMP_IDLE_MS,
} from "../../src/renderer/src/stats/pump-schedule";

describe("nextPumpDelayMs", () => {
  it("polls briskly while a backfill is in progress", () => {
    expect(nextPumpDelayMs({ filesTotal: 10, filesDone: 3, done: false })).toBe(
      PUMP_BACKFILL_MS,
    );
  });

  it("drops to the idle cadence once caught up", () => {
    expect(nextPumpDelayMs({ filesTotal: 10, filesDone: 10, done: true })).toBe(
      PUMP_IDLE_MS,
    );
  });

  it("idles on a failed poll (null) instead of spinning a hot loop", () => {
    expect(nextPumpDelayMs(null)).toBe(PUMP_IDLE_MS);
  });
});
