import { describe, it, expect } from 'vitest'
import type { Session } from '../../src/shared/types'
import { renameManaged } from '../../src/shared/managed'

const s = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  title: id,
  project: 'p',
  state: 'working',
  management: 'observed',
  model: 'claude-sonnet-4-6',
  contextPct: 0,
  contextWindow: 200_000,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  equivApiValueUsd: 0,
  lastActivityMs: 0,
  ...over,
})

describe('renameManaged', () => {
  it('re-points the rotated row to its new id and marks it Managed', () => {
    const out = renameManaged([s('A', { management: 'managed' })], 'A', 'B')
    expect(out.map((x) => x.id)).toEqual(['B'])
    expect(out[0].management).toBe('managed')
  })

  it('renames an optimistic draft (no message sent yet) so it does not linger as a phantom', () => {
    // The pre-clear case: a freshly spawned session's draft still carries the old id A.
    const out = renameManaged([s('A', { management: 'managed', state: 'working' })], 'A', 'B')
    expect(out.map((x) => x.id)).toEqual(['B'])
  })

  it('leaves the list untouched when a row for the new id already exists — the abandoned id stays an Ended ghost', () => {
    // Discovery already delivered the live B and the abandoned A as an Ended ghost; do not clobber either.
    const rows = [s('B', { management: 'managed', state: 'idle' }), s('A', { state: 'ended' })]
    const out = renameManaged(rows, 'A', 'B')
    expect(out).toEqual(rows)
  })

  it('is a no-op when the rotated id is absent', () => {
    const rows = [s('X')]
    expect(renameManaged(rows, 'A', 'B')).toEqual(rows)
  })
})
