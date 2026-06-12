import { join } from 'node:path'
import { readTextOrNull } from '../claude-config'

/** API-billing identity read from settings.json env. Present only when a base URL is configured — the
 *  absence of ANTHROPIC_BASE_URL means there's no API endpoint to surface, so the reader returns null. */
export interface ApiConfig {
  /** The configured endpoint, verbatim from ANTHROPIC_BASE_URL. The renderer strips the scheme for display. */
  baseUrl: string
  /** How the gateway authenticates — an auth token vs an API key. Omitted when neither env var is set. */
  authMethod?: 'token' | 'apiKey'
  /** Upstream provider from the x-portkey-provider entry of ANTHROPIC_CUSTOM_HEADERS, '@' stripped.
   *  Omitted when the header is absent. */
  provider?: string
}

/** Pull the x-portkey-provider value out of an ANTHROPIC_CUSTOM_HEADERS string. The string is one or more
 *  `Name: value` entries separated by newlines or commas; only that one entry is read, its leading '@' and
 *  surrounding whitespace stripped. Returns undefined when absent or empty. Every other header is ignored,
 *  so nothing else in the string (e.g. an authorization secret) can reach the UI. */
function parseProvider(headers: string): string | undefined {
  for (const entry of headers.split(/[\n,]/)) {
    const colon = entry.indexOf(':')
    if (colon < 0) continue
    if (entry.slice(0, colon).trim().toLowerCase() !== 'x-portkey-provider') continue
    const value = entry.slice(colon + 1).trim().replace(/^@/, '').trim()
    return value.length > 0 ? value : undefined
  }
  return undefined
}

/**
 * The API-billing config from `<claudeDir>/settings.json` env: ANTHROPIC_BASE_URL (required — null when
 * absent), the auth method (ANTHROPIC_AUTH_TOKEN vs ANTHROPIC_API_KEY), and the upstream provider (from
 * ANTHROPIC_CUSTOM_HEADERS). Best-effort: any absence, read failure, or malformed JSON returns null and
 * never throws. Only these keys are ever read — the auth token value and every other header stay unread,
 * so a secret can't reach the renderer.
 */
export function readApiConfig(claudeDir: string): ApiConfig | null {
  try {
    const raw = readTextOrNull(join(claudeDir, 'settings.json'))
    if (raw === null) return null
    const j = JSON.parse(raw) as Record<string, unknown>
    const env = (j.env ?? {}) as Record<string, unknown>
    const baseUrl = typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL.trim() : ''
    if (baseUrl.length === 0) return null
    const config: ApiConfig = { baseUrl }
    if (typeof env.ANTHROPIC_AUTH_TOKEN === 'string' && env.ANTHROPIC_AUTH_TOKEN.length > 0) {
      config.authMethod = 'token'
    } else if (typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.length > 0) {
      config.authMethod = 'apiKey'
    }
    if (typeof env.ANTHROPIC_CUSTOM_HEADERS === 'string') {
      const provider = parseProvider(env.ANTHROPIC_CUSTOM_HEADERS)
      if (provider) config.provider = provider
    }
    return config
  } catch {
    return null // unreadable file or malformed JSON — no API identity to surface
  }
}
