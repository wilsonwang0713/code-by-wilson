import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { createClaudeProvider } from '../../src/main/provider/claude'

describe('ClaudeProvider', () => {
  it('exposes capability flags and derives state across the fleet', async () => {
    const provider = createClaudeProvider({
      claudeDir: resolve('tests/fixtures/claude-home'),
      isPidAlive: (pid) => pid === 1001, // only this one is alive
    })

    expect(provider.id).toBe('claude')
    expect(provider.capabilities).toEqual({
      canControl: true,
      hasRateLimits: true,
      hasSubagents: true,
    })

    const sessions = await provider.listSessions()
    const working = sessions.find((s) => s.id === 'aaaa1111-1111-1111-1111-111111111111')
    expect(working?.state).toBe('working')
    // Dead sessions surface as Ended now, not dropped.
    expect(sessions.filter((s) => s.state === 'ended').length).toBeGreaterThan(0)
  })
})
