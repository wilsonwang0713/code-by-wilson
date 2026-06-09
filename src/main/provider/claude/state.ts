import type { SessionState } from '@shared/types'

export interface SessionStateSignals {
  /** Is the session's process still alive? */
  alive: boolean
  /** The `sessions/*.json` status field; `'busy'` means actively generating. */
  status: string | undefined
  /** Did the last turn leave a question or permission prompt unanswered? */
  awaitingUser: boolean
}

/**
 * Heuristic Session state from liveness, the status field, and the Transcript tail.
 * Precedence (top wins): a gone process is Ended no matter what; a live one that's
 * generating is Working; a quiet one blocked on an unanswered prompt is Waiting;
 * otherwise Idle. The opt-in Notification hook later upgrades Waiting to an exact
 * signal — this is the default heuristic.
 */
export function deriveSessionState({
  alive,
  status,
  awaitingUser,
}: SessionStateSignals): SessionState {
  if (!alive) return 'ended'
  if (status === 'busy') return 'working'
  if (awaitingUser) return 'waiting'
  return 'idle'
}
