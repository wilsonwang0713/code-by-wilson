import type { ScanProgress } from "@shared/stats";

/** Matches StatsView's BACKFILL_POLL_MS: brisk steps while a backfill is filling in, so a cold start
 *  or a post-reset rebuild completes in seconds. */
export const PUMP_BACKFILL_MS = 40;

/** The caught-up cadence. The pump exists so transcripts land in the durable mirror before Claude
 *  Code's cleanupPeriodDays (a matter of DAYS) can delete them — five minutes bounds staleness by
 *  orders of magnitude more than needed while keeping the idle walk (readdir + stat) negligible. */
export const PUMP_IDLE_MS = 5 * 60_000;

/** The pump's scheduling decision, kept pure (and React-free) so it's testable: brisk while a
 *  backfill is in progress, idle once caught up. `null` — the bridge-failure case; the handler
 *  itself never rejects — idles too, so a torn bridge retries gently instead of spinning. */
export function nextPumpDelayMs(progress: ScanProgress | null): number {
  return progress !== null && !progress.done ? PUMP_BACKFILL_MS : PUMP_IDLE_MS;
}
