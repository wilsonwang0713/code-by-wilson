/**
 * Per-file incremental scan decisions. The analytics scan keys on a stored `lines` high-water mark — the
 * count of newline-terminated lines already ingested. Transcripts are append-only, so a later pass parses
 * just the tail past that mark. A file whose complete-line count *shrank* (truncated or rotated in place)
 * is re-read from zero. A partial trailing line (no newline yet — a half-written append) is never counted,
 * so it's picked up only once the newline lands. Pure and JSX-free: the precision seam the scanner pins.
 */

/** A file's stored high-water mark. `mtime` gates whether the file is read at all (the scanner skips it
 *  when unchanged); `lines` is where the last pass stopped. */
export interface FileScanState {
  mtime: number;
  lines: number;
}

/** What to (re)parse for one file this pass. `jsonl` is the appended complete lines (or the whole file on
 *  a cold/shrunk read) joined by newlines; `startLine` is the absolute 0-based index of its first line,
 *  threaded into extractTurns so surrogate keys stay stable; `lines` is the new high-water mark. */
export interface FileScanPlan {
  jsonl: string;
  startLine: number;
  lines: number;
}

/** Count of newline-terminated lines. `split("\n")` of content ending in "\n" leaves a trailing "" — the
 *  boundary for the next, not-yet-written line — so the complete-line count is one less than the segments.
 *  A partial trailing line (content with no final newline) isn't counted until its newline arrives. */
function completeLineCount(segments: string[]): number {
  return segments.length - 1;
}

/**
 * Decide what to parse for one file given its prior state. Returns null when there's nothing new (the
 * complete-line count is unchanged) — the no-op that makes a re-run cheap. A cold file (no prior state)
 * or a shrunk one (fewer complete lines than stored) re-reads from line zero; otherwise only the lines
 * appended past the stored count.
 */
export function planFileScan(
  content: string,
  prev: FileScanState | undefined,
): FileScanPlan | null {
  const segments = content.split("\n");
  const lines = completeLineCount(segments);
  const complete = segments.slice(0, lines);
  if (!prev || lines < prev.lines) {
    return { jsonl: complete.join("\n"), startLine: 0, lines };
  }
  if (lines === prev.lines) return null;
  return {
    jsonl: complete.slice(prev.lines).join("\n"),
    startLine: prev.lines,
    lines,
  };
}
