import { basename } from 'node:path'
import { normalizeModelId, type ModelId } from '@shared/models'

export interface TranscriptSummary {
  title: string
  project: string
  cwd: string
  branch?: string
  model: ModelId
  lastActivityMs: number
}

/** First non-empty user prompt with tags stripped, else the project basename. */
export function deriveTitle(userPrompts: string[], cwd: string): string {
  for (const raw of userPrompts) {
    const cleaned = raw
      .replace(/<[^>]+>/g, '') // drop slash-command / tag wrappers, keep inner text
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned) return cleaned.length > 80 ? cleaned.slice(0, 79) + '…' : cleaned
  }
  return basename(cwd) || 'session'
}

/**
 * Reduce a transcript's JSONL into a normalized summary. Parses line by line and
 * skips any unparseable line, so a transcript being appended to right now (a
 * half-written trailing line) is fine.
 */
export function parseTranscript(jsonl: string, fallbackCwd = ''): TranscriptSummary {
  let cwd = fallbackCwd
  let branch: string | undefined
  let lastModelRaw: string | undefined
  let lastActivityMs = 0
  const userPrompts: string[] = []

  for (const line of jsonl.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let row: any
    try {
      row = JSON.parse(trimmed)
    } catch {
      continue
    }

    if (typeof row.cwd === 'string') cwd = row.cwd
    if (typeof row.gitBranch === 'string') branch = row.gitBranch

    if (typeof row.timestamp === 'string') {
      const ms = Date.parse(row.timestamp)
      if (!Number.isNaN(ms) && ms > lastActivityMs) lastActivityMs = ms
    }

    if (row.type === 'assistant' && typeof row.message?.model === 'string') {
      lastModelRaw = row.message.model
    }

    if (row.type === 'user' && !row.isMeta && typeof row.message?.content === 'string') {
      userPrompts.push(row.message.content)
    }
  }

  return {
    title: deriveTitle(userPrompts, cwd),
    project: basename(cwd) || 'unknown',
    cwd,
    branch,
    model: normalizeModelId(lastModelRaw),
    lastActivityMs,
  }
}
