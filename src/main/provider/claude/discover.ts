import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Session } from '@shared/types'
import { contextWindowFor, normalizeModelId } from '@shared/models'
import { parseTranscript, type TranscriptSummary } from './transcript'
import { deriveSessionState } from './state'

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

/** List a directory, treating a missing or unreadable dir as empty rather than throwing. */
function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** Read every well-formed `sessions/*.json`, skipping malformed files. */
export function readSessionFiles(claudeDir: string): RawSessionFile[] {
  const dir = join(claudeDir, 'sessions')

  const out: RawSessionFile[] = []
  for (const name of safeReaddir(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const j = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      if (typeof j.pid === 'number' && j.pid > 0 && typeof j.sessionId === 'string') {
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

  for (const proj of safeReaddir(projects)) {
    const candidate = join(projects, proj, `${sessionId}.jsonl`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Parse a session's transcript, treating a missing or unreadable file as no transcript. */
function readTranscriptSummary(
  claudeDir: string,
  sessionId: string,
  cwd: string,
): TranscriptSummary | null {
  const path = findTranscriptPath(claudeDir, sessionId)
  if (!path) return null
  try {
    return parseTranscript(readFileSync(path, 'utf8'), cwd)
  } catch {
    // A transcript that vanished or can't be read shouldn't sink the whole list;
    // this session degrades to its skeleton fallbacks (basename title, updatedAt).
    return null
  }
}

export function discoverSessions({ claudeDir, isPidAlive }: DiscoverDeps): Session[] {
  // Every well-formed session file becomes a row. Liveness is no longer a filter — it's a
  // signal fed into state derivation, so a session whose process is gone reads as Ended
  // instead of vanishing. Recency-bounded retention + incremental sync are issue #4.
  const files = readSessionFiles(claudeDir)
  // Collapse duplicate sessionIds so the snapshot is unique by construction, which is what the
  // SQLite primary key expects instead of aborting. Keep the freshest file per id (max updatedAt)
  // so the surviving row carries the current status and pid, not whichever file readdir happened
  // to yield last.
  const byId = new Map<string, RawSessionFile>()
  for (const s of files) {
    const prev = byId.get(s.sessionId)
    if (!prev || (s.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) byId.set(s.sessionId, s)
  }
  return [...byId.values()].map((s) =>
    toSession(s, isPidAlive(s.pid), readTranscriptSummary(claudeDir, s.sessionId, s.cwd)),
  )
}

function toSession(s: RawSessionFile, alive: boolean, t: TranscriptSummary | null): Session {
  const model = t ? t.model : normalizeModelId(undefined)
  const projectFromCwd = (s.cwd && basename(s.cwd)) || 'unknown'

  return {
    id: s.sessionId,
    title: t?.title ?? projectFromCwd,
    project: t?.project ?? projectFromCwd,
    branch: t?.branch,
    state: deriveSessionState({ alive, status: s.status, awaitingUser: t?.awaitingUser ?? false }),
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
