import { describe, it, expect } from 'vitest'
import { normalizeModelId, contextWindowFor } from '@shared/models'

describe('normalizeModelId', () => {
  it('maps known model strings to canonical ids', () => {
    expect(normalizeModelId('claude-opus-4-8')).toBe('claude-opus-4-8')
    expect(normalizeModelId('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
    expect(normalizeModelId('claude-haiku-4-5')).toBe('claude-haiku-4-5')
  })

  it('tolerates suffixes and unknowns by family, defaulting to opus', () => {
    expect(normalizeModelId('claude-opus-4-8[1m]')).toBe('claude-opus-4-8')
    expect(normalizeModelId(undefined)).toBe('claude-opus-4-8')
    expect(normalizeModelId('something-weird')).toBe('claude-opus-4-8')
  })
})

describe('contextWindowFor', () => {
  it('returns a positive token window for every model', () => {
    expect(contextWindowFor('claude-sonnet-4-6')).toBe(200_000)
  })
})
