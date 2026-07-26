import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import {
  parseNewestRateLimits,
  readCodexRateLimits,
} from "../../src/main/provider/codex/rate-limits";
import { tempHomes } from "../helpers/temp-home";

const makeHome = tempHomes("cbw-codexrl-");

/** A rollout row carrying a rate_limits block (the shape real token_count events write). */
const sample = (
  ts: string,
  primary: { pct: number; minutes: number; resetsAt: number } | null,
  secondary?: { pct: number; minutes: number; resetsAt: number },
) =>
  JSON.stringify({
    timestamp: ts,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: null,
      rate_limits: {
        limit_id: "codex",
        limit_name: null,
        ...(primary
          ? {
              primary: {
                used_percent: primary.pct,
                window_minutes: primary.minutes,
                resets_at: primary.resetsAt,
              },
            }
          : {}),
        ...(secondary
          ? {
              secondary: {
                used_percent: secondary.pct,
                window_minutes: secondary.minutes,
                resets_at: secondary.resetsAt,
              },
            }
          : {}),
      },
    },
  });

const RESET_S = 1_785_578_203; // epoch seconds, as rollouts record it

describe("parseNewestRateLimits", () => {
  it("maps the newest sample's windows, shortest first, seconds normalized to ms", () => {
    const jsonl = [
      sample("2026-07-26T09:00:00.000Z", {
        pct: 3,
        minutes: 10080,
        resetsAt: RESET_S,
      }),
      sample(
        "2026-07-26T10:00:00.000Z",
        { pct: 14.4, minutes: 10080, resetsAt: RESET_S },
        { pct: 55, minutes: 300, resetsAt: RESET_S - 1000 },
      ),
    ].join("\n");
    const out = parseNewestRateLimits(jsonl);
    expect(out).toEqual({
      asOfMs: Date.parse("2026-07-26T10:00:00.000Z"),
      windows: [
        { label: "5-hour", usedPct: 55, resetsAt: (RESET_S - 1000) * 1000 },
        { label: "7-day", usedPct: 14.4, resetsAt: RESET_S * 1000 },
      ],
    });
  });

  it("labels windows by duration: whole days, whole hours, then minutes", () => {
    const jsonl = sample("2026-07-26T10:00:00.000Z", {
      pct: 1,
      minutes: 90,
      resetsAt: RESET_S,
    });
    expect(parseNewestRateLimits(jsonl)?.windows[0].label).toBe("90-min");
  });

  it("clamps used_percent into 0..100", () => {
    const jsonl = sample("2026-07-26T10:00:00.000Z", {
      pct: 130,
      minutes: 300,
      resetsAt: RESET_S,
    });
    expect(parseNewestRateLimits(jsonl)?.windows[0].usedPct).toBe(100);
  });

  it("skips malformed lines and samples without a parseable timestamp", () => {
    const good = sample("2026-07-26T09:00:00.000Z", {
      pct: 7,
      minutes: 10080,
      resetsAt: RESET_S,
    });
    const bad = sample("not-a-date", {
      pct: 99,
      minutes: 10080,
      resetsAt: RESET_S,
    });
    const jsonl = [good, "not json {{{", bad].join("\n");
    const out = parseNewestRateLimits(jsonl);
    expect(out?.windows[0].usedPct).toBe(7); // the dated sample wins, not the newer undated one
  });

  it("returns null when no row carries a usable window", () => {
    const jsonl = [
      JSON.stringify({
        timestamp: "2026-07-26T10:00:00.000Z",
        type: "event_msg",
        payload: { type: "token_count", info: null },
      }),
      sample("2026-07-26T10:01:00.000Z", null),
    ].join("\n");
    expect(parseNewestRateLimits(jsonl)).toBeNull();
  });
});

describe("readCodexRateLimits", () => {
  const NOW = Date.parse("2026-07-26T12:00:00.000Z");

  function writeRollout(
    home: string,
    day: string,
    uuid: string,
    lines: string[],
    mtimeMs: number,
  ): void {
    const dir = join(home, "sessions", ...day.split("/"));
    mkdirSync(dir, { recursive: true });
    const path = join(
      dir,
      `rollout-${day.replaceAll("/", "-")}T00-00-00-${uuid}.jsonl`,
    );
    writeFileSync(path, lines.join("\n") + "\n");
    utimesSync(path, new Date(mtimeMs), new Date(mtimeMs));
  }

  it("reads the newest sample from the freshest recent rollout", () => {
    const home = makeHome();
    writeRollout(
      home,
      "2026/07/26",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      [
        sample("2026-07-26T10:00:00.000Z", {
          pct: 8,
          minutes: 10080,
          resetsAt: RESET_S,
        }),
      ],
      NOW - 60_000,
    );
    // an older file with a scarier number must lose to the fresher file
    writeRollout(
      home,
      "2026/07/25",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      [
        sample("2026-07-25T10:00:00.000Z", {
          pct: 90,
          minutes: 10080,
          resetsAt: RESET_S,
        }),
      ],
      NOW - 20 * 60 * 60 * 1000,
    );
    const out = readCodexRateLimits(home, NOW);
    expect(out?.windows[0].usedPct).toBe(8);
    expect(out?.asOfMs).toBe(Date.parse("2026-07-26T10:00:00.000Z"));
  });

  it("returns null for a missing home or when no recent rollout has a sample", () => {
    expect(readCodexRateLimits("/nonexistent-codex-home", NOW)).toBeNull();
    const home = makeHome();
    writeRollout(
      home,
      "2026/07/26",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      [
        JSON.stringify({
          timestamp: "2026-07-26T10:00:00.000Z",
          type: "event_msg",
          payload: { type: "token_count", info: null },
        }),
      ],
      NOW - 60_000,
    );
    expect(readCodexRateLimits(home, NOW)).toBeNull();
  });
});
