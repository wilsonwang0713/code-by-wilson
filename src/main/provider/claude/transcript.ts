import { basename } from 'node:path'
import { normalizeModelId, type ModelId } from '@shared/models'

export interface TranscriptSummary {
  title: string
  project: string
  cwd: string
  branch?: string
  model: ModelId
  lastActivityMs: number
  /** The last turn left a question or permission prompt unanswered (a tool_use with no result). */
  awaitingUser: boolean
}

// A slash-command user turn is a bundle of these envelope tags; its useful label
// is the command name, so we surface that and drop the rest. Everything outside
// this known set is left alone, so prose keeps its angle brackets (a < b, JSX,
// generics) instead of being shredded by a blanket tag strip.
const COMMAND_NAME = /<command-name>([\s\S]*?)<\/command-name>/
const COMMAND_ENVELOPE =
  /<(command-name|command-message|command-args|command-contents|local-command-stdout|local-command-stderr)>[\s\S]*?<\/\1>/g

/** First non-empty user prompt (slash commands shown by name), else the project basename. */
export function deriveTitle(userPrompts: string[], cwd: string): string {
  for (const raw of userPrompts) {
    const command = raw.match(COMMAND_NAME)?.[1]?.trim()
    const cleaned = command || raw.replace(COMMAND_ENVELOPE, '').replace(/\s+/g, ' ').trim()
    if (cleaned) return cleaned.length > 80 ? cleaned.slice(0, 79) + '…' : cleaned
  }
  return basename(cwd) || 'session'
}

/** A user turn's text, whether stored as a plain string or an array of content blocks. */
function userPromptText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b) => b?.type === 'text' && typeof b?.text === 'string')
      .map((b) => b.text)
      .join('\n')
  }
  return ''
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
  // tool_use ids the assistant has issued but no tool_result has answered yet. A non-empty
  // set at end of file means the last turn is blocked on the user (a permission prompt or an
  // AskUserQuestion) — which, once the session has gone quiet, is the Waiting signal.
  const unansweredToolUse = new Set<string>()

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

    const content = row.message?.content
    if (row.type === 'assistant' && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && typeof block.id === 'string') {
          unansweredToolUse.add(block.id)
        }
      }
    }

    if (row.type === 'user') {
      // A tool_result answers a pending tool_use. Clear it regardless of isMeta, mirroring the
      // unguarded add above, so the set never leaks a stale id into a false awaitingUser.
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
            unansweredToolUse.delete(block.tool_use_id)
          }
        }
      }
      // Only real (non-meta) user turns are prompts that can title the session.
      if (!row.isMeta) {
        const text = userPromptText(content)
        if (text) userPrompts.push(text)
      }
    }
  }

  return {
    title: deriveTitle(userPrompts, cwd),
    project: basename(cwd) || 'unknown',
    cwd,
    branch,
    model: normalizeModelId(lastModelRaw),
    lastActivityMs,
    awaitingUser: unansweredToolUse.size > 0,
  }
}
