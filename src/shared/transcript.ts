/**
 * The normalized, render-ready projection of one session's transcript. The Observed workspace view
 * consumes this; a Provider produces it from its native transcript format (Claude: JSONL). It lives
 * in @shared because both the main-process parser and the renderer depend on the same shape.
 *
 * This is a SECOND projection over the transcript, distinct from TranscriptSummary (token sums,
 * derived state). That one answers "what is this session"; this one answers "what does it look like".
 */

/** A minimal diff: the removed and added lines of an edit, already split on newline. */
export interface DiffHunk {
  removed: string[]
  added: string[]
}

/** One rendered item in the conversation, in file order. */
export type TranscriptEvent =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; name: string; input: string }
  | { kind: 'diff'; tool: string; file: string; hunk: DiffHunk }
  | { kind: 'subagent'; agentType: string; description: string }

export interface TranscriptDoc {
  /** The conversation, oldest first. */
  events: TranscriptEvent[]
  /** Non-null when the transcript's tail left a prompt unanswered: a human-readable reason (a
   *  question, or the pending tool). The workspace shows it prominently for a Waiting session. */
  waitingReason: string | null
}

/** A TranscriptDoc plus the source file's mtime, so the renderer can skip re-rendering an unchanged
 *  poll. Returned by the IPC read; null there means the session has no transcript on disk. */
export interface TranscriptView extends TranscriptDoc {
  mtimeMs: number
}
