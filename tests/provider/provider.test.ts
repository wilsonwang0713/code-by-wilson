import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { createClaudeProvider } from '../../src/main/provider/claude'

describe('ClaudeProvider', () => {
  it('exposes capability flags and the incremental sync primitives', () => {
    const provider = createClaudeProvider({
      claudeDir: resolve('tests/fixtures/claude-home'),
      isPidAlive: (pid) => pid === 1001, // only this one is alive
      now: () => Date.parse('2026-06-09T00:00:00.000Z'),
      recentWindowMs: 7 * 24 * 60 * 60 * 1000,
    })

    expect(provider.id).toBe('claude')
    expect(provider.capabilities).toEqual({ canControl: true, hasRateLimits: true, hasSubagents: true })

    const candidates = provider.listCandidates()
    expect(candidates).toHaveLength(5) // every fixture session surfaces (all registry-backed)
    const live = candidates.find((c) => c.id === 'aaaa1111-1111-1111-1111-111111111111')!
    expect(live.alive).toBe(true) // pid 1001 is the live one

    // summarize the live one → working; force it dead → ended, off the same transcript.
    expect(provider.summarize(live).state).toBe('working')
    expect(provider.summarize({ ...live, alive: false }).state).toBe('ended')
  })
})

describe('ClaudeProvider.readTranscript', () => {
  const provider = createClaudeProvider({ claudeDir: resolve('tests/fixtures/claude-home') })

  it('reads a session transcript into render-ready events with the file mtime', () => {
    const view = provider.readTranscript('aaaa1111-1111-1111-1111-111111111111')
    expect(view).not.toBeNull()
    expect(view!.events[0]).toEqual({ kind: 'user', text: 'Add a login form to the settings page' })
    expect(view!.waitingReason).toBeNull()
    expect(view!.mtimeMs).toBeGreaterThan(0)
  })

  it('surfaces the waiting reason when the tail is an unanswered question', () => {
    const view = provider.readTranscript('dddd4444-4444-4444-4444-444444444444')
    expect(view!.waitingReason).toBe('Expand-contract or big-bang?')
  })

  it('returns null for a session with no transcript file', () => {
    expect(provider.readTranscript('no-such-session')).toBeNull()
  })
})
