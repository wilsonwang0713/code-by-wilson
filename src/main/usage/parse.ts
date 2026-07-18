import type { RateLimit, ScopedRateLimit, ExtraUsage } from "@shared/types";
import type { AccountUsage } from "@shared/statusline";

/** One usage-API bucket → RateLimit. `resets_at` is an ISO STRING here (epoch seconds on the
 *  statusLine stdin — the reader handles that form). A null bucket (Enterprise, ccs #343) or
 *  missing/malformed fields → undefined: buckets degrade independently, same trust-boundary style
 *  as the capture reader's parseWindow. */
function parseBucket(raw: unknown): RateLimit | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.utilization !== "number" || !Number.isFinite(r.utilization))
    return undefined;
  if (typeof r.resets_at !== "string") return undefined;
  const resetsAt = Date.parse(r.resets_at);
  if (Number.isNaN(resetsAt)) return undefined;
  return { usedPct: r.utilization, resetsAt };
}

/** The `extra_usage` block → ExtraUsage when `is_enabled` is a boolean; other fields degrade
 *  independently. `monthly_limit`/`used_credits` stay in cents — display divides by 100. */
function parseExtraUsage(raw: unknown): ExtraUsage | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.is_enabled !== "boolean") return undefined;
  const extra: ExtraUsage = { enabled: r.is_enabled };
  if (typeof r.monthly_limit === "number" && Number.isFinite(r.monthly_limit))
    extra.limit = r.monthly_limit;
  if (typeof r.used_credits === "number" && Number.isFinite(r.used_credits))
    extra.used = r.used_credits;
  if (typeof r.utilization === "number" && Number.isFinite(r.utilization))
    extra.utilization = r.utilization;
  if (typeof r.currency === "string" && r.currency) extra.currency = r.currency;
  return extra;
}

/** The modern `limits[]` array, one entry per window: `session` and `weekly_all` mirror the legacy
 *  flat buckets (which the API now serves as null alongside), and `weekly_scoped` entries are the
 *  per-model weekly windows, labeled by their scope's model display_name ("Fable"). Malformed
 *  entries drop individually, same trust boundary as parseBucket. */
function parseLimits(raw: unknown): {
  session?: RateLimit;
  weeklyAll?: RateLimit;
  scoped: ScopedRateLimit[];
} {
  const out: {
    session?: RateLimit;
    weeklyAll?: RateLimit;
    scoped: ScopedRateLimit[];
  } = { scoped: [] };
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.percent !== "number" || !Number.isFinite(r.percent)) continue;
    if (typeof r.resets_at !== "string") continue;
    const resetsAt = Date.parse(r.resets_at);
    if (Number.isNaN(resetsAt)) continue;
    const w: RateLimit = { usedPct: r.percent, resetsAt };
    if (r.kind === "session") out.session ??= w;
    else if (r.kind === "weekly_all") out.weeklyAll ??= w;
    else if (r.kind === "weekly_scoped") {
      const scope = r.scope as
        | { model?: { display_name?: unknown } | null; surface?: unknown }
        | null
        | undefined;
      const model = scope?.model?.display_name;
      const surface = scope?.surface;
      const label =
        typeof model === "string" && model
          ? model
          : typeof surface === "string" && surface
            ? surface
            : "Scoped";
      out.scoped.push({ ...w, label });
    }
  }
  return out;
}

/**
 * Map a `/api/oauth/usage` 200 body into AccountUsage. Returns null only when the body isn't an
 * object; an object with no usable bucket still parses (empty AccountUsage) — that response is
 * subscription evidence and renders as dashed rows. Deliberate deviation from ccstatusline, which
 * classes a bucket-less 200 as a parse error (spec: Response mapping, audit note).
 */
export function parseUsageResponse(body: unknown): AccountUsage | null {
  if (body === null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const usage: AccountUsage = {};
  const fiveHour = parseBucket(b.five_hour);
  const sevenDay = parseBucket(b.seven_day);
  const sevenDayFable = parseBucket(b.seven_day_fable);
  const sevenDaySonnet = parseBucket(b.seven_day_sonnet);
  const sevenDayOpus = parseBucket(b.seven_day_opus);
  if (fiveHour) usage.fiveHour = fiveHour;
  if (sevenDay) usage.sevenDay = sevenDay;
  if (sevenDayFable) usage.sevenDayFable = sevenDayFable;
  if (sevenDaySonnet) usage.sevenDaySonnet = sevenDaySonnet;
  if (sevenDayOpus) usage.sevenDayOpus = sevenDayOpus;
  // The limits[] array: aggregates fill in only where the legacy flat buckets were null (the API
  // is mid-migration and serves both), scoped weeklies ride along with their labels.
  const limits = parseLimits(b.limits);
  if (!usage.fiveHour && limits.session) usage.fiveHour = limits.session;
  if (!usage.sevenDay && limits.weeklyAll) usage.sevenDay = limits.weeklyAll;
  if (limits.scoped.length > 0) usage.sevenDayScoped = limits.scoped;
  const extraUsage = parseExtraUsage(b.extra_usage);
  if (extraUsage) usage.extraUsage = extraUsage;
  return usage;
}
