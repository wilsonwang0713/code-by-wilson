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
