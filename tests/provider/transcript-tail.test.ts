import { describe, it, expect } from 'vitest'
import { parseTranscript } from '../../src/main/provider/claude/transcript'
import { parseTranscriptEvents } from '../../src/main/provider/claude/transcript-events'
import { createTailTracker } from '../../src/main/provider/claude/transcript-tail'
import { contextTotal } from '@shared/context'

const jsonl = (...rows: object[]) => rows.map((r) => JSON.stringify(r)).join('\n')

describe('summary and render projections agree (consolidated tail)', () => {
  it('agree on the waiting signal and the context size for a tail that asks a question', () => {
    const t = jsonl(
      { type: 'user', isMeta: false, cwd: '/w/app', message: { role: 'user', content: 'go' } },
      { type: 'assistant', message: { id: 'm1', role: 'assistant', model: 'claude-opus-4-8', usage: { input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 9000, cache_creation_input_tokens: 400 }, content: [{ type: 'tool_use', id: 't1', name: 'AskUserQuestion', input: { questions: [{ question: 'A or B?' }] } }] } },
    )
    const sum = parseTranscript(t)
    const doc = parseTranscriptEvents(t)
    expect(sum.awaitingUser).toBe(doc.waitingReason !== null)
    expect(doc.waitingReason).toBe('A or B?')
    expect(sum.contextTokens).toBe(doc.context ? contextTotal(doc.context) : 0)
    expect(sum.contextTokens).toBe(9500) // 100 + 9000 + 400
  })

  it('agree that a fully-answered tail is not waiting', () => {
    const t = jsonl(
      { type: 'assistant', message: { id: 'm1', role: 'assistant', usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, content: [{ type: 'tool_use', id: 'b1', name: 'Bash', input: {} }] } },
      { type: 'user', isMeta: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'done' }] } },
    )
    const sum = parseTranscript(t)
    const doc = parseTranscriptEvents(t)
    expect(sum.awaitingUser).toBe(false)
    expect(doc.waitingReason).toBeNull()
    expect(sum.contextTokens).toBe(doc.context ? contextTotal(doc.context) : 0)
  })
})

describe('createTailTracker', () => {
  it('tracks unanswered tool_use scoped to the latest turn, and the latest context split', () => {
    const t = createTailTracker()
    t.beginAssistantTurn('m1')
    t.noteUsage({ input_tokens: 1, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 })
    t.noteToolUse('a1', 'AskUserQuestion', { questions: [{ question: 'Ship it?' }] })
    expect(t.awaitingUser).toBe(true)
    expect(t.waitingReason()).toBe('Ship it?')
    expect(t.context).toEqual({ input: 1, cacheRead: 100, cacheCreation: 0 })
    t.resolveToolResult('a1')
    expect(t.awaitingUser).toBe(false)
    expect(t.waitingReason()).toBeNull()
  })

  it('a new turn supersedes the previous turn\'s pending tools; a zero-usage turn keeps the last split', () => {
    const t = createTailTracker()
    t.beginAssistantTurn('m1')
    t.noteUsage({ input_tokens: 5, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 })
    t.noteToolUse('b1', 'Bash', {})
    t.beginAssistantTurn('m2') // new turn
    t.noteUsage({ input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) // synthetic
    expect(t.awaitingUser).toBe(false)
    expect(t.context).toEqual({ input: 5, cacheRead: 50, cacheCreation: 0 }) // unchanged by the zero-sum turn
  })
})
