import type { SessionState } from "@shared/types";

/** The slice of Session the inbox reads — narrow so tests build rows without the full type. */
export interface InboxCandidate {
  id: string;
  title: string;
  project: string;
  state: SessionState;
  /** The transcript-derived reason a waiting session is waiting, when known. */
  waitingReason?: string;
  lastActivityMs: number;
  /** Claude Code's own session cost (Session.costUsd) — the running rows' small $ readout.
   *  Display-only; absent ⇒ no sample yet, so the row falls back to its state. */
  costUsd?: number;
}

/** An attention row: the candidate plus the human reason line the inbox renders. */
export interface InboxRow extends InboxCandidate {
  reason: string;
}

export interface InboxPartition {
  /** Sessions that need the user — waiting, plus just-ended — oldest first (US-3 AC3). */
  attention: InboxRow[];
  /** Everything else still live (working/idle), newest activity first. */
  running: InboxCandidate[];
}

/** How long an ended session stays in the attention section before it ages out. The inbox is a
 *  live-state view with no persistence (spec non-goal #8), so "just finished" simply decays. */
export const RECENT_ENDED_MS = 5 * 60_000;

/** Mirrors AWAITING_BODY in notifications/decide.ts: the parser can't distinguish prompt kinds yet. */
export const AWAITING_REASON = "Waiting for your input";
export const ENDED_REASON = "Finished";

function reasonFor(s: InboxCandidate): string {
  return s.state === "waiting"
    ? s.waitingReason || AWAITING_REASON
    : ENDED_REASON;
}

export function partitionInbox(
  sessions: readonly InboxCandidate[],
  nowMs: number,
): InboxPartition {
  const attention = sessions
    .filter(
      (s) =>
        s.state === "waiting" ||
        (s.state === "ended" && nowMs - s.lastActivityMs <= RECENT_ENDED_MS),
    )
    .slice()
    .sort((a, b) => a.lastActivityMs - b.lastActivityMs)
    .map((s) => ({ ...s, reason: reasonFor(s) }));
  const running = sessions
    .filter((s) => s.state === "working" || s.state === "idle")
    .slice()
    .sort((a, b) => b.lastActivityMs - a.lastActivityMs);
  return { attention, running };
}

/** The signature a dismissal is pinned to: the session's state plus the timestamp of the episode
 *  that was showing. A dismissed attention row stays hidden only while this is unchanged — once the
 *  session is answered and later re-enters `waiting` (a fresh lastActivityMs) the signature differs,
 *  so the row re-surfaces rather than staying suppressed forever (US-3 dismiss). */
export function dismissalSignature(s: InboxCandidate): string {
  return `${s.state}:${s.lastActivityMs}`;
}

/** Drops the attention rows the user dismissed. `dismissed` maps sessionId → the signature the row
 *  carried when it was dismissed; a row is hidden only while its current signature still matches, so
 *  the filter is pure and a row reappears the instant its signature moves on. */
export function applyDismissals(
  attention: readonly InboxRow[],
  dismissed: ReadonlyMap<string, string>,
): InboxRow[] {
  return attention.filter(
    (row) => dismissed.get(row.id) !== dismissalSignature(row),
  );
}
