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
