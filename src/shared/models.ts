export const MODEL_IDS = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
] as const

export type ModelId = (typeof MODEL_IDS)[number]

/** Map a raw transcript model string (possibly suffixed, e.g. "[1m]") to a canonical ModelId. */
export function normalizeModelId(raw: string | undefined): ModelId {
  if (!raw) return 'claude-opus-4-8'
  if (raw.includes('opus')) return 'claude-opus-4-8'
  if (raw.includes('sonnet')) return 'claude-sonnet-4-6'
  if (raw.includes('haiku')) return 'claude-haiku-4-5'
  return 'claude-opus-4-8'
}

/**
 * Token context window for a model. The skeleton uses a single baseline; real
 * per-model and 1M-variant windows arrive with context % work (a later issue).
 */
export function contextWindowFor(_model: ModelId): number {
  return 200_000
}
