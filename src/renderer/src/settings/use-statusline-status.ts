import { useEffect, useRef, useState } from "react";
import type { StatuslineStatus } from "@shared/statusline-status";

const POLL_MS = 3000;

/**
 * Polls the statusline status while mounted (the System section) on the app's standard 3s cadence.
 * Mutating actions apply the status the handler returns immediately instead of waiting for the next
 * tick. Every request (poll or mutation) claims a monotonically increasing generation token; a
 * request only applies its result if its generation is still the latest one issued, so a poll that
 * was already in flight when a mutation fired can't clobber the mutation's fresher result. Polls are
 * additionally deduped locally (skip if one is already in flight) purely to avoid pointless pile-up —
 * mutations are never blocked by that.
 */
export function useStatuslineStatus(): {
  status: StatuslineStatus | null;
  setEnabled: (enabled: boolean) => void;
  setRefreshInterval: (seconds: number | null) => void;
  repair: () => void;
} {
  const [status, setStatus] = useState<StatuslineStatus | null>(null);
  const latest = useRef(0); // generation of the most-recently-issued request

  useEffect(() => {
    let alive = true;
    let inFlight = false; // skip overlapping polls only; never blocks mutations
    async function tick(): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      const gen = ++latest.current;
      try {
        const s = await window.api.getStatuslineStatus();
        if (alive && gen === latest.current) setStatus(s);
      } catch {
        // main never rejects by design; a torn bridge just keeps the last readout
      } finally {
        inFlight = false;
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  function apply(p: Promise<StatuslineStatus>): void {
    const gen = ++latest.current; // this action is now the latest; older in-flight polls won't clobber
    p.then((s) => {
      if (gen === latest.current) setStatus(s);
    }).catch(() => {});
  }

  return {
    status,
    setEnabled: (enabled) => apply(window.api.setStatuslineEnabled(enabled)),
    setRefreshInterval: (seconds) =>
      apply(window.api.setStatuslineRefreshInterval(seconds)),
    repair: () => apply(window.api.repairStatusline()),
  };
}
