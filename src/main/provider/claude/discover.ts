import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Session, SessionState } from '@shared/types'
import { contextWindowFor, normalizeModelId } from '@shared/models'
import { parseTranscript, type TranscriptSummary } from './transcript'

export interface RawSessionFile {
  pid: number
  sessionId: string
  cwd: string
  status?: string
  updatedAt?: number
}

export interface DiscoverDeps {
  claudeDir: string
  isPidAlive: (pid: number) => boolean
}

/** Read every well-formed `sessions/*.json`, skipping malformed files. */
export function readSessionFiles(claudeDir: string): RawSessionFile[] {
  const dir = join(claudeDir, 'sessions')
  if (!existsSync(dir)) return []

  const out: RawSessionFile[] = []
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const j = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      if (typeof j.pid === 'number' && typeof j.sessionId === 'string') {
        out.push({
          pid: j.pid,
          sessionId: j.sessionId,
          cwd: typeof j.cwd === 'string' ? j.cwd : '',
          status: j.status,
          updatedAt: j.updatedAt,
        })
      }
    } catch {
      // skip malformed session file
    }
  }
  return out
}

/** Find `projects/<encoded>/<sessionId>.jsonl` without depending on the cwd→dir encoding. */
export function findTranscriptPath(claudeDir: string, sessionId: string): string | null {
  const projects = join(claudeDir, 'projects')
  if (!existsSync(projects)) return null

  for (const proj of readdirSync(projects)) {
    const candidate = join(projects, proj, `${sessionId}.jsonl`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function discoverSessions({ claudeDir, isPidAlive }: DiscoverDeps): Session[] {
  return readSessionFiles(claudeDir)
    .filter((s) => isPidAlive(s.pid))
    .map((s) => {
      const path = findTranscriptPath(claudeDir, s.sessionId)
      const summary = path ? parseTranscript(readFileSync(path, 'utf8'), s.cwd) : null
      return toSession(s, summary)
    })
}

/** Minimal skeleton state. Full Working/Waiting/Idle/Ended derivation is a later issue. */
function deriveState(status: string | undefined): SessionState {
  return status === 'busy' ? 'working' : 'idle'
}

function toSession(s: RawSessionFile, t: TranscriptSummary | null): Session {
  const model = t ? t.model : normalizeModelId(undefined)
  const projectFromCwd = s.cwd ? basename(s.cwd) : 'unknown'

  return {
    id: s.sessionId,
    title: t?.title ?? projectFromCwd,
    project: t?.project ?? projectFromCwd,
    branch: t?.branch,
    state: deriveState(s.status),
    management: 'observed', // managed sessions arrive with spawning (later issue)
    model,
    contextPct: 0, // later issue
    contextWindow: contextWindowFor(model),
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, // later issue
    equivApiValueUsd: 0, // later issue
    lastActivityMs: t?.lastActivityMs || s.updatedAt || 0,
    tasks: [], // later issue
    subagents: [], // later issue
  }
}
