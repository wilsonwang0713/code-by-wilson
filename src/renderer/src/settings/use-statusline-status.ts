import { useEffect, useRef, useState } from "react";
import type { StatuslineStatus } from "@shared/statusline-status";

const POLL_MS = 3000;

/**
 * Polls the statusline status while mounted (the System section) on the app's standard 3s cadence.
 * Mutating actions apply the status the handler returns immediately instead of waiting for the next
 * tick; the shared in-flight guard keeps an overlapping poll from clobbering that fresher result.
 */
export function useStatuslineStatus(): {
  status: StatuslineStatus | null;
  setEnabled: (enabled: boolean) => void;
  setRefreshInterval: (seconds: number | null) => void;
  repair: () => void;
} {
  const [status, setStatus] = useState<StatuslineStatus | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    async function tick(): Promise<void> {
      if (busy.current) return;
      busy.current = true;
      try {
        const s = await window.api.getStatuslineStatus();
        if (alive) setStatus(s);
      } catch {
        // main never rejects by design; a torn bridge just keeps the last readout
      } finally {
        busy.current = false;
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
    busy.current = true;
    p.then((s) => setStatus(s))
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }

  return {
    status,
    setEnabled: (enabled) => apply(window.api.setStatuslineEnabled(enabled)),
    setRefreshInterval: (seconds) =>
      apply(window.api.setStatuslineRefreshInterval(seconds)),
    repair: () => apply(window.api.repairStatusline()),
  };
}
