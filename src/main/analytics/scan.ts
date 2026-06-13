import { readFileSync } from "node:fs";
import type { SqliteDb } from "../db/driver";
import { upsertTurns, type AnalyticsTurn } from "../db/analytics";
import { indexTranscripts } from "../provider/claude/discover";
import { extractTurns } from "../provider/claude/turns";

/**
 * Ingest every assistant turn from every Transcript on disk into the analytics store. Walks the full
 * projects/ tree via indexTranscripts (which, unlike the live discovery's recency-windowed candidate
 * list, enumerates every transcript regardless of age), so "all-time" genuinely means all-time.
 *
 * Slice 1 reads each file whole and upserts by message id (last-write-wins), so a re-run is idempotent.
 * One unreadable transcript is skipped, not fatal (mirrors summarize). Performance and incrementality —
 * appended-line reads, chunked yielding passes, and bounding the all-turns accumulation + single upsert
 * transaction so a long history doesn't spike memory — come in a later slice.
 */
export function scanAllTranscripts(db: SqliteDb, claudeDir: string): void {
  const turns: AnalyticsTurn[] = [];
  for (const [sessionId, { path }] of indexTranscripts(claudeDir)) {
    let jsonl: string;
    try {
      jsonl = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    turns.push(...extractTurns(jsonl, sessionId));
  }
  upsertTurns(db, turns);
}
