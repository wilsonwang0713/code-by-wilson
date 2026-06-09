import type { ModelId } from './models'

export type { ModelId }

export type SessionState = 'working' | 'waiting' | 'idle' | 'ended'
export type Management = 'managed' | 'observed'

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export interface Task {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  blockedBy?: string[]
}

export interface Subagent {
  id: string
  type: string
  status: 'working' | 'done' | 'failed'
  model: ModelId
  tokens: number
  durationMs: number
  children?: Subagent[]
}

export interface Session {
  id: string
  title: string
  project: string
  branch?: string
  state: SessionState
  management: Management
  model: ModelId
  contextPct: number
  contextWindow: number
  usage: Usage
  equivApiValueUsd: number
  lastActivityMs: number
  currentTask?: string
  waitingReason?: string
  tasks: Task[]
  subagents: Subagent[]
}

/**
 * The narrow per-session snapshot the index actually persists. Everything a SQLite row holds and
 * nothing the skeleton fabricates: no zeroed usage/cost/context/tasks — those are filled by
 * `hydrate` in one place when a row is read back, so the DB stops hand-authoring defaults twice.
 */
export interface PersistedSession {
  id: string
  title: string
  project: string
  branch?: string
  state: SessionState
  management: Management
  model: ModelId
  lastActivityMs: number
  /** Last parsed transcript tail left a prompt unanswered. Stored so state can be recomputed on a
   *  sync that skips the (unchanged) transcript, without reparsing it. */
  awaitingUser: boolean
  /** mtime (ms) of the transcript when it was last parsed — the incremental high-water mark. A sync
   *  reparses only when the file's current mtime exceeds this. 0 means the session has no transcript. */
  transcriptMtimeMs: number
}

export interface RateLimit {
  usedPct: number
  resetsAt: number
}

export interface Account {
  billingMode: 'subscription' | 'api'
  plan: string
  fiveHour: RateLimit
  sevenDay: RateLimit
}

/** What a Provider can do. Drives graceful degradation in the UI. */
export interface ProviderCapabilities {
  canControl: boolean
  hasRateLimits: boolean
  hasSubagents: boolean
}
