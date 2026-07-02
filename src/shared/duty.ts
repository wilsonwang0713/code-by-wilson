/** The session's duty cycle: the % of its wall-clock lifetime an API request was in flight
 *  (cost.total_api_duration_ms over cost.total_duration_ms). null when either clock is missing or
 *  the wall clock is unusable — the Duty panel renders "-". Clamped 0–100 so disagreeing clocks
 *  can't draw an impossible bar. Cumulative since session start by design (no rolling window). */
export function dutyPct(
  apiMs: number | null | undefined,
  wallMs: number | null | undefined,
): number | null {
  if (apiMs == null || wallMs == null) return null;
  if (!Number.isFinite(apiMs) || !Number.isFinite(wallMs) || wallMs <= 0)
    return null;
  return Math.min(100, Math.max(0, Math.round((apiMs / wallMs) * 100)));
}
