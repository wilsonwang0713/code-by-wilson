import type { Session, ProviderCapabilities } from './types'

export const IPC = {
  listSessions: 'sessions:list',
  refresh: 'sessions:refresh',
  capabilities: 'provider:capabilities',
} as const

export interface IpcApi {
  listSessions(): Promise<Session[]>
  refresh(): Promise<Session[]>
  capabilities(): Promise<ProviderCapabilities>
}
