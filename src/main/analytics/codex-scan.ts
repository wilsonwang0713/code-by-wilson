import { basename } from "node:path";
import { listRolloutFiles } from "../provider/codex/discover";
import type { ScanTarget } from "./scan";

/**
 * The warm-poll walk window: the live provider's 30-day recency plus generous slack, so the
 * steady-state walk touches a handful of recent day dirs instead of the whole multi-month tree
 * (~18k files on a heavy machine). A rollout OLDER than this that still grows (a resumed weeks-old
 * session) is caught by the next launch's full sweep — the accepted trade-off for a cheap poll.
 */
export const CODEX_RECENT_WALK_MS = 35 * 24 * 60 * 60 * 1000;

/**
 * Every Codex rollout inside the window as an analytics scan target — the Codex analogue of
 * collectScanTargets' transcript walk. `windowMs: Infinity` is the launch backfill's full-history
 * sweep. `keyPrefix` is the rollout FILENAME stem, not the session id: two files can share a
 * session id (a resumed session's second rollout), and per-file stems keep their line-keyed
 * surrogates from colliding while `sessionId` still folds both into one session for the stats
 * cuts. A missing ~/.codex yields zero targets (listRolloutFiles' ENOENT posture).
 */
export function collectCodexScanTargets(
  codexDir: string,
  nowMs: number,
  windowMs: number,
): ScanTarget[] {
  return listRolloutFiles(codexDir, nowMs, windowMs).map((f) => ({
    path: f.path,
    mtimeMs: f.mtimeMs,
    sessionId: f.id,
    keyPrefix: basename(f.path, ".jsonl"),
    kind: "codex" as const,
  }));
}
