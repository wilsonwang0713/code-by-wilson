import type { Session, ProviderCapabilities } from './types'
import type { TranscriptRead } from './transcript'
import type { TerminalApi } from './terminal'
import type { Stats } from './stats'

export const IPC = {
  listSessions: 'sessions:list',
  refresh: 'sessions:refresh',
  capabilities: 'provider:capabilities',
  readTranscript: 'transcript:read',
  stats: 'stats:get',
} as const

export interface IpcApi {
  listSessions(): Promise<Session[]>
  refresh(): Promise<Session[]>
  capabilities(): Promise<ProviderCapabilities>
  readTranscript(id: string, sinceMtimeMs?: number): Promise<TranscriptRead>
  stats(): Promise<Stats>
}

/** Everything exposed on `window.api`: the request/response surface plus the Managed-terminal surface. */
export type AppApi = IpcApi & { terminal: TerminalApi }
