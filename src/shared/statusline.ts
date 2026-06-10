import type { Account, RateLimit, Session } from './types'

/** One normalized statusLine capture for a Session, parsed from a side-channel file. Plain data so it
 *  crosses IPC cleanly. `null` fields are "the statusLine didn't report this", distinct from 0. */
export interface StatusLineSample {
  sessionId: string
  /** File mtime (ms) of the capture — its freshness, used to pick the account snapshot. */
  capturedMtimeMs: number
  costUsd: number | null
  linesAdded: number | null
  linesRemoved: number | null
  /** Live context fill 0–100 (statusLine used_percentage), or null when the statusLine omitted it. */
  contextPct: number | null
  /** Live context window size (tokens), or null when omitted. */
  contextWindow: number | null
  /** Account rate limits — present only for a subscription; null for an API account. Each window may
   *  be independently absent (the statusLine populates them after the first API response). */
  rateLimits: { fiveHour?: RateLimit; sevenDay?: RateLimit } | null
}

/** The seam ipc.ts depends on: the live captures the wrapper writes. Implemented in main by a file reader. */
export interface StatusLineReader {
  /** All current captures, one (freshest) per file. */
  read(): StatusLineSample[]
}

/** Freshest sample per Session id — a session that wrote several captures keeps only its newest. */
export function freshestBySession(samples: StatusLineSample[]): Map<string, StatusLineSample> {
  const byId = new Map<string, StatusLineSample>()
  for (const s of samples) {
    const prev = byId.get(s.sessionId)
    if (!prev || s.capturedMtimeMs > prev.capturedMtimeMs) byId.set(s.sessionId, s)
  }
  return byId
}

/**
 * The app-wide Account from the freshest sample captured within `staleMs` of `now`. Billing mode is
 * detected from rate-limit presence (ADR-0001): a capture carrying rate_limits is a subscription, one
 * without is an API account. Returns null when there's no recent statusLine data at all, which the UI
 * reads as "no rate-limit bars" — graceful degradation. A capture older than the window is ignored: it
 * can't faithfully describe a 5-hour or 7-day window that has long since reset.
 */
export function deriveAccount(samples: StatusLineSample[], now: number, staleMs: number): Account | null {
  let freshest: StatusLineSample | null = null
  for (const s of samples) {
    if (now - s.capturedMtimeMs > staleMs) continue
    if (!freshest || s.capturedMtimeMs > freshest.capturedMtimeMs) freshest = s
  }
  if (!freshest) return null
  if (!freshest.rateLimits) return { billingMode: 'api' }
  return {
    billingMode: 'subscription',
    fiveHour: freshest.rateLimits.fiveHour,
    sevenDay: freshest.rateLimits.sevenDay,
  }
}

/**
 * Overlay live statusLine numbers onto each Session that has a sample. Cost, lines, and context come
 * from the statusLine when present; a Session with no sample passes through untouched, still showing
 * its transcript-computed context % and Equivalent API value (graceful degradation, ADR-0001). A sample
 * that omitted a field falls back to the Session's computed value for that field.
 */
export function overlaySessions(sessions: Session[], byId: Map<string, StatusLineSample>): Session[] {
  if (byId.size === 0) return sessions.slice()
  return sessions.map((s) => {
    const sample = byId.get(s.id)
    if (!sample) return s
    return {
      ...s,
      contextPct: sample.contextPct ?? s.contextPct,
      contextWindow: sample.contextWindow ?? s.contextWindow,
      liveCostUsd: sample.costUsd ?? undefined,
      linesAdded: sample.linesAdded ?? undefined,
      linesRemoved: sample.linesRemoved ?? undefined,
    }
  })
}
