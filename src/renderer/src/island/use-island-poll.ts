import { useEffect, useState } from "react";
import type { Session } from "@shared/types";

/** The island's poll cadence. Matches the main window's SYNC_MS so the pill and the session rail
 *  can't disagree for longer than one cycle (US-3 AC4), and keeps the ≤5s visibility bound of
 *  US-2 AC2 with room to spare. No power-saving downshift in P0 — a slower cadence would break
 *  that bound (RD review §2). */
export const ISLAND_SYNC_MS = 3000;

/**
 * The island window's own session poll. refresh() — not overview() — so the index keeps syncing
 * against ~/.claude even when the island is the only window left (US-1 AC3: the pill must stay
 * live after the main window closes). The sync is incremental (mtime high-water marks), so the
 * second consumer costs one indexed SQLite read per tick, not a re-parse.
 */
export function useIslandPoll(): Session[] {
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = async (): Promise<void> => {
      try {
        const o = await window.api.refresh();
        if (alive) setSessions(o.sessions);
      } catch {
        // A failed poll keeps the last snapshot; the next tick retries.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), ISLAND_SYNC_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return sessions;
}
