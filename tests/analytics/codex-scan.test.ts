import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import {
  collectCodexScanTargets,
  CODEX_RECENT_WALK_MS,
} from "../../src/main/analytics/codex-scan";
import { tempHomes } from "../helpers/temp-home";

const makeHome = tempHomes("cbw-codexscan-");
const DAY = 24 * 60 * 60 * 1000;
// A fixed "now" that lands mid-2026 so the day-dir names below are meaningful.
const NOW = Date.parse("2026-07-26T12:00:00.000Z");

function writeRollout(
  home: string,
  day: string, // "2026/07/10"
  stem: string, // filename without .jsonl
  mtimeMs: number,
): string {
  const dir = join(home, "sessions", ...day.split("/"));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${stem}.jsonl`);
  writeFileSync(path, "");
  utimesSync(path, new Date(mtimeMs), new Date(mtimeMs));
  return path;
}

describe("collectCodexScanTargets", () => {
  it("maps rollouts to codex targets keyed by filename stem", () => {
    const home = makeHome();
    const stem =
      "rollout-2026-07-10T10-00-00-cccc1111-1111-4111-8111-111111111111";
    const p = writeRollout(home, "2026/07/10", stem, NOW - 16 * DAY);
    const targets = collectCodexScanTargets(home, NOW, Infinity);
    expect(targets).toEqual([
      {
        path: p,
        mtimeMs: NOW - 16 * DAY,
        sessionId: "cccc1111-1111-4111-8111-111111111111",
        keyPrefix: stem,
        kind: "codex",
      },
    ]);
  });

  it("a recent-window walk drops old rollouts a full sweep keeps", () => {
    const home = makeHome();
    writeRollout(
      home,
      "2026/01/01",
      "rollout-2026-01-01T08-00-00-cccc3333-3333-4333-8333-333333333333",
      NOW - 200 * DAY,
    );
    writeRollout(
      home,
      "2026/07/25",
      "rollout-2026-07-25T09-00-00-cccc4444-4444-4444-8444-444444444444",
      NOW - DAY,
    );
    expect(collectCodexScanTargets(home, NOW, Infinity)).toHaveLength(2);
    const recent = collectCodexScanTargets(home, NOW, CODEX_RECENT_WALK_MS);
    expect(recent).toHaveLength(1);
    expect(recent[0].sessionId).toBe("cccc4444-4444-4444-8444-444444444444");
  });

  it("a missing codex home is empty, not an error", () => {
    expect(
      collectCodexScanTargets("/nonexistent-codex-home", NOW, Infinity),
    ).toEqual([]);
  });
});
