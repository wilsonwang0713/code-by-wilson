import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { RateLimit } from '@shared/types'
import type { StatusLineReader, StatusLineSample } from '@shared/statusline'
import { resolveClaudeDir } from '../claude-config'

export interface StatusLineReaderDeps {
  /** Claude config dir; defaults via resolveClaudeDir. Tests inject a temp dir. */
  claudeDir?: string
}

/** Where the wrapper writes one JSON capture per Session (`<sessionId>.json`). */
function statusLineDir(claudeDir: string): string {
  return join(claudeDir, '.code-by-wire', 'statusline')
}

/** A finite number, or null — the trust-boundary coercion for every numeric field. */
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** One window of the raw `rate_limits` block → RateLimit, converting resets_at (epoch s) to epoch ms.
 *  Returns undefined when the window is absent or malformed (windows degrade independently). */
function parseWindow(raw: unknown): RateLimit | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const usedPct = num(r.used_percentage)
  const resetsAtSec = num(r.resets_at)
  if (usedPct === null || resetsAtSec === null) return undefined
  return { usedPct, resetsAt: resetsAtSec * 1000 }
}

/** Parse one statusLine JSON blob into a sample. Defensive: a missing/mistyped field degrades to null,
 *  never throws. Returns null only when there's no usable session id to key the capture by. */
function parseSample(raw: string, capturedMtimeMs: number): StatusLineSample | null {
  let j: Record<string, unknown>
  try {
    const v = JSON.parse(raw)
    if (v === null || typeof v !== 'object') return null
    j = v as Record<string, unknown>
  } catch {
    return null
  }
  const sessionId = typeof j.session_id === 'string' ? j.session_id : null
  if (!sessionId) return null

  const cost = (j.cost ?? {}) as Record<string, unknown>
  const ctx = (j.context_window ?? {}) as Record<string, unknown>
  const rl = j.rate_limits
  let rateLimits: StatusLineSample['rateLimits'] = null
  if (rl !== null && typeof rl === 'object') {
    const r = rl as Record<string, unknown>
    rateLimits = { fiveHour: parseWindow(r.five_hour), sevenDay: parseWindow(r.seven_day) }
  }

  const pct = num(ctx.used_percentage)
  return {
    sessionId,
    capturedMtimeMs,
    costUsd: num(cost.total_cost_usd),
    linesAdded: num(cost.total_lines_added),
    linesRemoved: num(cost.total_lines_removed),
    contextPct: pct === null ? null : Math.min(100, Math.max(0, Math.round(pct))),
    contextWindow: num(ctx.context_window_size),
    rateLimits,
  }
}

/**
 * Reads the per-Session statusLine captures the wrapper writes. Read-on-demand — one cheap dir scan
 * plus small JSON reads per Overview pass, mirroring how the Observed view polls. No fs.watch, no
 * daemon: the app is windowed-only and the 3s Overview refresh is the merge cadence. An absent dir
 * (nothing installed yet, or no captures) reads as "no live data": an empty list, never an error.
 */
export function createStatusLineReader(deps: StatusLineReaderDeps = {}): StatusLineReader {
  const dir = statusLineDir(resolveClaudeDir(deps.claudeDir))
  return {
    read(): StatusLineSample[] {
      let names: string[]
      try {
        names = readdirSync(dir)
      } catch {
        return []
      }
      const out: StatusLineSample[] = []
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        const path = join(dir, name)
        try {
          const mtimeMs = statSync(path).mtimeMs
          const sample = parseSample(readFileSync(path, 'utf8'), mtimeMs)
          if (sample) out.push(sample)
        } catch {
          // a file that vanished mid-scan or won't read — skip it, never sink the pass
        }
      }
      return out
    },
  }
}
