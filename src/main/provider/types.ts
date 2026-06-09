import type { ProviderCapabilities, PersistedSession, SessionCandidate } from '@shared/types'

export interface Provider {
  readonly id: string
  readonly capabilities: ProviderCapabilities
  /** Cheap enumeration of the sessions worth indexing this pass — no transcript parsed. */
  listCandidates(): SessionCandidate[]
  /** Parse a candidate's transcript into a full snapshot (the expensive step). */
  summarize(candidate: SessionCandidate): PersistedSession
  /** Refresh a reused snapshot's state from fresh liveness, without reparsing the transcript. */
  restate(candidate: SessionCandidate, previous: PersistedSession): PersistedSession
}
