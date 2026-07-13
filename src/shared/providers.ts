import type { ProviderCapabilities } from "./types";

/**
 * The provider registry both processes share: main stamps `providerId` onto every session it indexes
 * (see createMultiProvider), the renderer looks the id back up here to degrade per-session UI. A
 * static table rather than a per-session field over IPC because capabilities are a property of the
 * provider *implementation*, not of any one session — shipping them per row would just be N copies
 * of this constant.
 */
export const CLAUDE_PROVIDER_ID = "claude";
export const CODEX_PROVIDER_ID = "codex";

/** The id a session carries when its snapshot predates the providerId field (a cached SQLite row
 *  written before multi-provider landed). Those rows were all Claude's — it was the only provider. */
export const DEFAULT_PROVIDER_ID = CLAUDE_PROVIDER_ID;

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  // What Claude Code can do; the capability contract predates multi-provider and is stable.
  [CLAUDE_PROVIDER_ID]: {
    canControl: true,
    hasRateLimits: true,
    hasSubagents: true,
  },
  // Codex v1 is observe-only: no pty spawning, no adopt/fork, no statusline captures. Its rollout
  // files do carry rate-limit samples, but there is no live capture pipeline for them, so the panel
  // honestly claims none rather than showing stale numbers.
  [CODEX_PROVIDER_ID]: {
    canControl: false,
    hasRateLimits: false,
    hasSubagents: false,
  },
};

/** Read-only capabilities for anything unrecognized: a session from a provider this build doesn't
 *  know must never be offered controls (Adopt/Fork spawn `claude`, which would 400 or worse). */
const UNKNOWN_CAPABILITIES: ProviderCapabilities = {
  canControl: false,
  hasRateLimits: false,
  hasSubagents: false,
};

/** The capabilities behind a session's providerId. Absent (a pre-field cached row) means Claude;
 *  an unknown id degrades to read-only rather than inheriting Claude's control surface. */
export function capabilitiesOf(providerId?: string): ProviderCapabilities {
  return (
    PROVIDER_CAPABILITIES[providerId ?? DEFAULT_PROVIDER_ID] ??
    UNKNOWN_CAPABILITIES
  );
}
