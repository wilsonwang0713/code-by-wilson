import type { SessionState } from "@shared/types";

/** The slice of Session the pill reads — narrow so tests build rows without the full type. */
export interface GlanceCandidate {
  state: SessionState;
}

/** What the collapsed pill renders: counts plus the preformatted label (US-2 AC1). */
export interface Glance {
  /** Non-ended sessions. */
  total: number;
  /** Sessions currently awaiting the user (state === "waiting", same rule as decide.ts). */
  waiting: number;
  /** "N sessions · M waiting", or "No sessions" when nothing is live (US-2 AC3). */
  label: string;
  /** Drives the pill's attention marker; false whenever waiting is 0 (US-2 AC3). */
  hasAttention: boolean;
}

export function deriveGlance(sessions: readonly GlanceCandidate[]): Glance {
  const live = sessions.filter((s) => s.state !== "ended");
  const waiting = live.filter((s) => s.state === "waiting").length;
  const total = live.length;
  const label =
    total === 0
      ? "No sessions"
      : `${total} session${total === 1 ? "" : "s"} · ${waiting} waiting`;
  return { total, waiting, label, hasAttention: waiting > 0 };
}
