import { closeSync, openSync, readSync, statSync } from "node:fs";
import type { CodexRateLimits, ScopedRateLimit } from "@shared/types";
import { listRolloutFiles } from "./discover";
import { rowTimestampMs } from "./rollout";

/**
 * Codex account rate limits from disk. Rollout token_count events carry a `rate_limits` block —
 * `{primary, secondary}`, each `{used_percent, window_minutes, resets_at}` — the account's state as
 * of that request. The newest dated sample in the freshest recent rollout is therefore the best
 * known state; anything older is history. Consumes `any` from external JSON by design (the
 * repo-wide no-unsafe-* downgrade exists for exactly this).
 */

/** How far back the freshest-rollout walk looks. A sample older than this is far past the display
 *  freshness gate anyway (CODEX_LIMITS_FRESH_MS), so the walk stays a handful of day dirs. */
const WALK_WINDOW_MS = 48 * 60 * 60 * 1000;

/** How much of the freshest rollout's tail is read for a sample. Samples arrive once per request,
 *  so the last ~128KiB always holds the newest one on any realistically active session. */
const TAIL_BYTES = 128 * 1024;

/** A window's display label from its duration: whole days, whole hours, else raw minutes. */
function windowLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440}-day`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour`;
  return `${minutes}-min`;
}

/** One `{used_percent, window_minutes, resets_at}` block as a gauge row, or null when any part is
 *  missing/malformed. `resets_at` is epoch seconds on disk; the app's RateLimit shape is ms. */
function windowFrom(
  block: any,
): (ScopedRateLimit & { minutes: number }) | null {
  const pct = block?.used_percent;
  const minutes = block?.window_minutes;
  const resetsAt = block?.resets_at;
  if (
    typeof pct !== "number" ||
    !Number.isFinite(pct) ||
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    typeof resetsAt !== "number" ||
    !Number.isFinite(resetsAt) ||
    resetsAt <= 0
  )
    return null;
  return {
    label: windowLabel(minutes),
    usedPct: Math.max(0, Math.min(100, pct)),
    resetsAt: resetsAt * 1000,
    minutes,
  };
}

/**
 * The newest usable rate-limit sample in a rollout's JSONL: the LAST row that carries an object
 * `payload.rate_limits`, a parseable row timestamp (a sample with no honest as-of can't be shown),
 * and at least one well-formed window. Windows emit shortest first, matching the Claude card's
 * 5-hour-then-7-day order. Null when no row qualifies.
 */
export function parseNewestRateLimits(jsonl: string): CodexRateLimits | null {
  let newest: CodexRateLimits | null = null;
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: any;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue; // half-written or malformed line
    }
    const limits = row?.payload?.rate_limits;
    if (!limits || typeof limits !== "object") continue;
    const asOfMs = rowTimestampMs(row);
    if (asOfMs === null) continue;
    const windows = [limits.primary, limits.secondary]
      .map(windowFrom)
      .filter((w): w is ScopedRateLimit & { minutes: number } => w !== null)
      .sort((a, b) => a.minutes - b.minutes)
      .map(({ label, usedPct, resetsAt }) => ({ label, usedPct, resetsAt }));
    if (windows.length === 0) continue;
    newest = { windows, asOfMs }; // later dated samples overwrite earlier ones
  }
  return newest;
}

/** The last `maxBytes` of a file as UTF-8, with any partial first line dropped when the read
 *  started mid-file — the same tail posture as discover's readIndexTitles. */
function tailReadUtf8(path: string, maxBytes: number): string {
  const size = statSync(path).size;
  const start = Math.max(0, size - maxBytes);
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.allocUnsafe(Math.min(size, maxBytes));
    let filled = 0;
    while (filled < buf.length) {
      const bytes = readSync(
        fd,
        buf,
        filled,
        buf.length - filled,
        start + filled,
      );
      if (bytes === 0) break;
      filled += bytes;
    }
    let text = buf.toString("utf8", 0, filled);
    if (start > 0) text = text.slice(text.indexOf("\n") + 1);
    return text;
  } finally {
    closeSync(fd);
  }
}

// The overview poll calls the reader a few times a second across windows; the freshest rollout only
// changes when Codex writes. Memoize the parse on (path, mtime) so a quiet poll is one stat.
const cache = new Map<
  string,
  { mtimeMs: number; result: CodexRateLimits | null }
>();

/**
 * The account's freshest Codex rate-limit sample: the newest dated sample in the freshest-mtime
 * rollout of the last 48h. Rate limits are account-scoped, so the most recently written session
 * carries the truth. Null — never a throw — when ~/.codex is absent, nothing recent exists, or the
 * freshest rollout holds no usable sample (the card then simply omits the section).
 */
export function readCodexRateLimits(
  codexDir: string,
  nowMs: number,
): CodexRateLimits | null {
  try {
    const files = listRolloutFiles(codexDir, nowMs, WALK_WINDOW_MS);
    if (files.length === 0) return null;
    let freshest = files[0];
    for (const f of files) if (f.mtimeMs > freshest.mtimeMs) freshest = f;
    const hit = cache.get(freshest.path);
    if (hit && hit.mtimeMs === freshest.mtimeMs) return hit.result;
    const result = parseNewestRateLimits(
      tailReadUtf8(freshest.path, TAIL_BYTES),
    );
    cache.set(freshest.path, { mtimeMs: freshest.mtimeMs, result });
    return result;
  } catch {
    return null; // an unreadable file/home degrades to "no section", never an error
  }
}
