import { join } from "node:path";
import {
  FAMILIES,
  isKnownModelString,
  normalizeModelId,
  type Family,
  type ModelDefaults,
} from "@shared/models";
import { readTextOrNull } from "../claude-config";

/** A trimmed, non-empty string, else undefined. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Read the model configuration from `<claudeDir>/settings.json` and the provided env map.
 * Collects per-family `ANTHROPIC_DEFAULT_<FAMILY>_MODEL` overrides (settings env takes precedence
 * over process env), the default family (from `ANTHROPIC_MODEL`, else the settings `model` key,
 * normalized to a family), and `availableModels` intersected to known families. Best-effort: any
 * absence or read failure returns `{ overrides: {} }` and never throws.
 */
export function readModelDefaults(
  claudeDir: string,
  env: Record<string, string | undefined>,
): ModelDefaults {
  const result: ModelDefaults = { overrides: {} };
  try {
    let settingsEnv: Record<string, unknown> = {};
    let settingsModel: unknown;
    let settingsAvailable: unknown;

    const raw = readTextOrNull(join(claudeDir, "settings.json"));
    if (raw !== null) {
      const j = JSON.parse(raw) as Record<string, unknown>;
      settingsEnv = (j.env ?? {}) as Record<string, unknown>;
      settingsModel = j.model;
      settingsAvailable = j.availableModels;
    }

    // Per-family overrides: settings env wins over process env. Trimmed and non-empty, same as the
    // default, so a blank or whitespace-only override is dropped rather than shown as "Opus ( )".
    for (const family of FAMILIES) {
      const key = `ANTHROPIC_DEFAULT_${family.toUpperCase()}_MODEL`;
      const value = str(settingsEnv[key]) ?? str(env[key]);
      if (value) result.overrides[family] = value;
    }

    // Default family: prefer the ANTHROPIC_MODEL env var (settings env over process env), else the
    // settings `model` key, normalized to a family. Mirrors Claude Code's resolution — ANTHROPIC_MODEL
    // outranks the settings `model` key, and either may be an alias (`sonnet`) or a full id
    // (`claude-sonnet-4-6`, a gateway-prefixed `global.anthropic.claude-sonnet-4-6`). When nothing is
    // configured the built-in default is account-tier-dependent and not derivable offline, so the picker
    // keeps its own last-resort fallback.
    const rawDefault =
      str(settingsEnv.ANTHROPIC_MODEL) ??
      str(env.ANTHROPIC_MODEL) ??
      str(settingsModel);
    if (rawDefault) result.default = normalizeModelId(rawDefault);

    // Available models: normalize each entry to its family (so a full id like
    // `global.anthropic.claude-sonnet-4-6` resolves to `sonnet`, matching how the default is read),
    // drop anything that maps to no known family, and dedupe preserving first-seen order. Exact-alias
    // matching here would fail open — a full-id allowlist would intersect to empty and the picker would
    // silently offer every family.
    if (Array.isArray(settingsAvailable)) {
      const allowed: Family[] = [];
      for (const v of settingsAvailable) {
        if (typeof v !== "string" || !isKnownModelString(v)) continue;
        const family = normalizeModelId(v);
        if (!allowed.includes(family)) allowed.push(family);
      }
      if (allowed.length > 0) result.allowed = allowed;
    }

    // If a default was set but isn't in the allowlist, drop it — the wire contract requires
    // that default is always one of the offered families.
    if (
      result.allowed &&
      result.default &&
      !result.allowed.includes(result.default)
    ) {
      delete result.default;
    }
  } catch {
    // Unreadable file or malformed JSON — return whatever we built so far (at minimum { overrides: {} }).
  }
  return result;
}
