import { useEffect } from "react";
import { atom } from "nanostores";
import type { ScanProgress } from "@shared/stats";
import { nextPumpDelayMs } from "./pump-schedule";

/** The pump's latest scan progress, for readers that render scan state (the Settings Stats-database
 *  card's lamp) without driving a scan of their own. null until the first tick lands. */
export const $scanProgress = atom<ScanProgress | null>(null);

/** The live pump's "run a step now" handle, registered by the mounted hook. null when no pump is
 *  mounted, so kickStatsPump() is then a no-op. Lets an external action wake the pump immediately
 *  instead of waiting out its idle cadence. */
let kick: (() => void) | null = null;

/** Run a pump step now: clears the pending idle timer and re-ticks, so a just-cleared store rebuilds
 *  (and the lamp flips to BACKFILLING) within a frame rather than up to PUMP_IDLE_MS later. Used by the
 *  Settings card after a reset, when the Stats view is closed and the pump is the only scan driver.
 *  No-op when no pump is mounted. */
export function kickStatsPump(): void {
  kick?.();
}

/**
 * Drives the analytics scan for the app's lifetime, independent of the Stats view: one bounded scan
 * step per tick, brisk (40ms) while a backfill is filling in, then a gentle 5-minute idle cadence —
 * so transcripts land in the durable mirror before Claude Code's cleanupPeriodDays can delete them
 * (spec 2026-07-10). Deliberately does NOT pause on document.hidden: ingesting while the user isn't
 * looking is the point. StatsView's own poll is untouched; both drive the same idempotent,
 * mtime-gated scan, and a caught-up step is a no-op walk.
 */
export function useStatsPump(): void {
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    // Set when a kick arrives mid-flight: the settling tick re-runs immediately instead of scheduling,
    // so a kick can never spawn a second, overlapping poll loop yet still guarantees a fresh step runs.
    let kickPending = false;
    function tick(): void {
      if (inFlight) {
        kickPending = true;
        return;
      }
      inFlight = true;
      kickPending = false;
      void window.api
        .pumpStats()
        .then((progress) => {
          inFlight = false;
          if (!alive) return;
          $scanProgress.set(progress);
          if (kickPending) tick();
          else timer = setTimeout(tick, nextPumpDelayMs(progress));
        })
        .catch(() => {
          // The handler never rejects by design; reaching here means the IPC bridge itself failed.
          // Keep the last progress and retry at the idle cadence (or immediately if a kick is pending).
          inFlight = false;
          if (!alive) return;
          if (kickPending) tick();
          else timer = setTimeout(tick, nextPumpDelayMs(null));
        });
    }
    // Register this mount's kick handle: clear the pending idle timer and run a step now (or, if a step
    // is already in flight, coalesce into a re-run when it settles).
    const kickThis = (): void => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      tick();
    };
    kick = kickThis;
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (kick === kickThis) kick = null;
    };
  }, []);
}
