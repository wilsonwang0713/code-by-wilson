import { describe, it, expect } from 'vitest'
import type { PersistedSession } from '@shared/types'
import { computeStats } from '@shared/stats'

const DAY = 86_400_000
// A fixed "now" at a known UTC-day start keeps the 7-day trend buckets deterministic.
// 1_700_000_000_000 ms = 2023-11-14T22:13:20Z; its UTC day starts here:
const TODAY = Math.floor(1_700_000_000_000 / DAY) * DAY
const NOW = TODAY + 12 * 3_600_000 // midday, to prove bucketing ignores the time-of-day

const snap = (over: Partial<PersistedSession> = {}): PersistedSession => ({
  id: 'id-1',
  title: 'Title',
  project: 'proj',
  branch: undefined,
  state: 'idle',
  management: 'observed',
  model: 'claude-opus-4-8',
  lastActivityMs: NOW,
  awaitingUser: false,
  transcriptMtimeMs: 0,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  contextTokens: 0,
  ...over,
})

// Opus usage worth exactly $1.2625 (100k·$5 + 20k·$25 + 400k·$0.5 + 10k·$6.25, per million).
const OPUS_USAGE = { inputTokens: 100_000, outputTokens: 20_000, cacheReadTokens: 400_000, cacheCreationTokens: 10_000 }

describe('computeStats', () => {
  it('returns 7 zeroed day buckets and empty mix/rollup for no sessions', () => {
    const s = computeStats([], NOW)
    expect(s.weeklyActivity).toHaveLength(7)
    expect(s.weeklyActivity.every((d) => d.sessions === 0 && d.equivApiValueUsd === 0)).toBe(true)
    expect(s.modelMix).toEqual([])
    expect(s.projectRollup).toEqual([])
  })

  it(`orders the 7 day buckets oldest-first, ending on now's UTC day`, () => {
    const s = computeStats([], NOW)
    expect(s.weeklyActivity.map((d) => d.dayStartMs)).toEqual([
      TODAY - 6 * DAY, TODAY - 5 * DAY, TODAY - 4 * DAY, TODAY - 3 * DAY,
      TODAY - 2 * DAY, TODAY - DAY, TODAY,
    ])
  })

  it('buckets a session into the UTC day of its last activity, regardless of time of day', () => {
    const sessions = [
      snap({ id: 'today', lastActivityMs: TODAY + 23 * 3_600_000 }), // late in today
      snap({ id: 'yest', lastActivityMs: TODAY - DAY + 60_000 }), // just after midnight yesterday
      snap({ id: 'yest2', lastActivityMs: TODAY - DAY + 5 * 3_600_000 }),
    ]
    const s = computeStats(sessions, NOW)
    const today = s.weeklyActivity[6]
    const yesterday = s.weeklyActivity[5]
    expect(today.sessions).toBe(1)
    expect(yesterday.sessions).toBe(2)
  })

  it('excludes sessions older than the 7-day trend window from the trend, but keeps them in mix and rollup', () => {
    const old = snap({ id: 'old', lastActivityMs: TODAY - 30 * DAY, usage: OPUS_USAGE })
    const s = computeStats([old], NOW)
    expect(s.weeklyActivity.every((d) => d.sessions === 0)).toBe(true)
    expect(s.modelMix).toHaveLength(1)
    expect(s.modelMix[0].sessions).toBe(1)
    expect(s.projectRollup).toHaveLength(1)
    expect(s.projectRollup[0].sessions).toBe(1)
  })

  it('sums Equivalent API value per session into each day bucket', () => {
    const s = computeStats([snap({ usage: OPUS_USAGE }), snap({ id: 'id-2', usage: OPUS_USAGE })], NOW)
    expect(s.weeklyActivity[6].sessions).toBe(2)
    expect(s.weeklyActivity[6].equivApiValueUsd).toBeCloseTo(2.525) // 2 × $1.2625
  })

  it('groups model mix by model, biggest Equivalent API value first', () => {
    const sessions = [
      snap({ id: 'o', model: 'claude-opus-4-8', usage: OPUS_USAGE }), // $1.2625
      snap({ id: 'h', model: 'claude-haiku-4-5', usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } }), // $1.00
      snap({ id: 'h2', model: 'claude-haiku-4-5', usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } }), // $0
    ]
    const s = computeStats(sessions, NOW)
    expect(s.modelMix.map((m) => m.model)).toEqual(['claude-opus-4-8', 'claude-haiku-4-5'])
    expect(s.modelMix[0]).toEqual({ model: 'claude-opus-4-8', sessions: 1, equivApiValueUsd: expect.closeTo(1.2625, 4) })
    expect(s.modelMix[1].sessions).toBe(2)
    expect(s.modelMix[1].equivApiValueUsd).toBeCloseTo(1.0)
  })

  it('rolls up per project — session counts and summed value across mixed models — biggest value first', () => {
    const sessions = [
      snap({ id: 'a', project: 'alpha', model: 'claude-opus-4-8', usage: OPUS_USAGE }), // $1.2625
      snap({ id: 'b', project: 'alpha', model: 'claude-haiku-4-5', usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } }), // $1.00
      snap({ id: 'c', project: 'beta', model: 'claude-haiku-4-5', usage: { inputTokens: 500_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } }), // $0.50
    ]
    const s = computeStats(sessions, NOW)
    expect(s.projectRollup).toEqual([
      { project: 'alpha', sessions: 2, equivApiValueUsd: expect.closeTo(2.2625, 4) },
      { project: 'beta', sessions: 1, equivApiValueUsd: expect.closeTo(0.5, 4) },
    ])
  })

  it('breaks equal-value ties by name so the order is deterministic', () => {
    const sessions = [
      snap({ id: 'z', project: 'zebra', usage: OPUS_USAGE }),
      snap({ id: 'a', project: 'apple', usage: OPUS_USAGE }),
    ]
    const s = computeStats(sessions, NOW)
    expect(s.projectRollup.map((p) => p.project)).toEqual(['apple', 'zebra'])
  })
})
