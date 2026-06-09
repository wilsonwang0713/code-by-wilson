import type { ProviderCapabilities, PersistedSession, SessionCandidate } from '@shared/types'
import type { TranscriptView } from '@shared/transcript'

export interface Provider {
  readonly id: string
  readonly capabilities: ProviderCapabilities
  /** Cheap enumeration of the sessions worth indexing this pass — no transcript parsed. */
  listCandidates(): SessionCandidate[]
  /** Parse a candidate's transcript into a full snapshot (the expensive step). */
  summarize(candidate: SessionCandidate): PersistedSession
  /** Refresh a reused snapshot's state from fresh liveness, without reparsing the transcript. */
  restate(candidate: SessionCandidate, previous: PersistedSession): PersistedSession
  /** Read one session's transcript into render-ready events. Null when the session has no transcript
   *  file (registry-only) or it's gone. The on-demand read behind the Observed workspace view. */
  readTranscript(id: string): TranscriptView | null
}
