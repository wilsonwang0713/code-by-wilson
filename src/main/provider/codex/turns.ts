import type { Usage } from "@shared/types";
import type { AnalyticsTurn } from "../../db/analytics";
import { projectFromCwd } from "../../project-name";
import { rowTimestampMs } from "./rollout";

/**
 * Project a Codex rollout's JSONL into one turn record per token_count snapshot — the Codex analogue
 * of the Claude provider's extractTurns. A rollout records CUMULATIVE totals (total_token_usage is a
 * running counter), so per-request usage is the component-wise delta between consecutive snapshots;
 * verified on disk, that delta equals the row's own last_token_usage. Deltas always sum to the final
 * cumulative totals, so the analytics store reconciles exactly with the live provider's summary.
 *
 * State (current model from the newest turn_context, cwd/branch from session_meta, the previous
 * totals) folds from line 0 regardless of the emission window `[startLine, startLine + take)`, so an
 * incremental step keys and values the SAME rows a whole-file parse would — that is what makes the
 * scan's upserts idempotent. Keys are `<keyPrefix>#<absoluteLine>` (token_count rows carry no id);
 * the scan passes the rollout filename stem as keyPrefix so two files sharing a session id (a
 * resumed session's second rollout) can't collide. Consumes `any` from external JSON by design (the
 * repo-wide no-unsafe-* downgrade exists for exactly this).
 */
export function extractCodexTurns(
  content: string,
  sessionId: string,
  keyPrefix: string = sessionId,
  startLine = 0,
  take = Infinity,
): AnalyticsTurn[] {
  const out: AnalyticsTurn[] = [];
  let cwd = "";
  let branch: string | undefined;
  const lines = content.split("\n");
  // Seed with the file's FIRST declared model: subagent threads (Codex Desktop) stream token_counts
  // from the head while their first turn_context lands hundreds of lines later — those early
  // snapshots belong to the model the file declares, not to an "Unknown" bucket. The running loop
  // below still lets a mid-session /model switch re-attribute later snapshots (newest wins). A
  // rollout with no turn_context at all stays honestly unattributed.
  let model: string | undefined = firstDeclaredModel(lines);
  let prev = ZERO_TOTALS;
  for (let i = 0; i < lines.length; i++) {
    if (i >= startLine + take) break;
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    let row: any;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue; // half-written or malformed line
    }
    const payload = row?.payload;
    if (!payload || typeof payload !== "object") continue;

    if (row.type === "session_meta") {
      if (typeof payload.cwd === "string" && payload.cwd) cwd = payload.cwd;
      const gitBranch = payload.git?.branch;
      if (typeof gitBranch === "string" && gitBranch) branch = gitBranch;
      continue;
    }
    if (row.type === "turn_context") {
      // Newest wins: a /model mid-session re-attributes later snapshots, like Claude's lastModelRaw.
      if (typeof payload.model === "string" && payload.model)
        model = payload.model;
      if (!cwd && typeof payload.cwd === "string" && payload.cwd)
        cwd = payload.cwd;
      continue;
    }
    if (row.type !== "event_msg" || payload.type !== "token_count") continue;
    // `info` is null on rate-limit-only samples; only a real usage block moves the counter.
    const total = payload.info?.total_token_usage;
    if (!total || typeof total !== "object") continue;
    const cur = totalsFrom(total);
    const usage = deltaUsage(prev, cur);
    prev = cur;
    if (i < startLine) continue; // before this step's window: state only, no emission
    if (isZero(usage)) continue; // a repeated snapshot is not a turn
    const ts = rowTimestampMs(row);
    out.push({
      messageId: `${keyPrefix}#${i}`,
      sessionId,
      ts: ts ?? 0,
      modelRaw: model,
      usage,
      cwd,
      project: projectFromCwd(cwd),
      branch,
    });
  }
  return out;
}

/** The first turn_context model the file declares anywhere, for seeding pre-context snapshots.
 *  The includes() prefilter keeps the pre-scan a cheap substring pass over non-matching lines. */
function firstDeclaredModel(lines: string[]): string | undefined {
  for (const line of lines) {
    if (!line.includes('"turn_context"')) continue;
    try {
      const row = JSON.parse(line);
      const m = row?.type === "turn_context" ? row.payload?.model : undefined;
      if (typeof m === "string" && m) return m;
    } catch {
      // skip a half-written or malformed line
    }
  }
  return undefined;
}

/** The cumulative counters a token_count snapshot carries. */
interface Totals {
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
}

const ZERO_TOTALS: Totals = { input: 0, cached: 0, cacheWrite: 0, output: 0 };

/** A finite non-negative number, else 0 — usage fields can be absent/null in older rollouts. */
function posNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

function totalsFrom(t: any): Totals {
  return {
    input: posNum(t?.input_tokens),
    cached: posNum(t?.cached_input_tokens),
    cacheWrite: posNum(t?.cache_write_input_tokens),
    output: posNum(t?.output_tokens),
  };
}

/**
 * One request's usage: the component-wise delta between consecutive cumulative snapshots. Any
 * component shrinking means the counter reset (a fresh thread baseline) — the snapshot itself is
 * then the delta, never a negative. Codex's input_tokens INCLUDES the cached part; the Usage shape
 * keeps them disjoint, so cached is subtracted out of input (clamped for pathological snapshots).
 * Cache writes carry no 5m/1h split, so the whole amount lands in the 5m bucket (the same
 * "5m + 1h == total" fallback the v2 migration seeded).
 */
function deltaUsage(prev: Totals, cur: Totals): Usage {
  const reset =
    cur.input < prev.input ||
    cur.cached < prev.cached ||
    cur.cacheWrite < prev.cacheWrite ||
    cur.output < prev.output;
  const base = reset ? ZERO_TOTALS : prev;
  const cached = cur.cached - base.cached;
  const cacheWrite = cur.cacheWrite - base.cacheWrite;
  return {
    inputTokens: Math.max(0, cur.input - base.input - cached),
    outputTokens: cur.output - base.output,
    cacheReadTokens: cached,
    cacheCreationTokens: cacheWrite,
    cacheCreation5mTokens: cacheWrite,
    cacheCreation1hTokens: 0,
  };
}

function isZero(u: Usage): boolean {
  return (
    u.inputTokens === 0 &&
    u.outputTokens === 0 &&
    u.cacheReadTokens === 0 &&
    u.cacheCreationTokens === 0
  );
}
