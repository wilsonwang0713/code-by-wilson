import type { CliStatus } from "@shared/cli-status";

export interface SpawnGate {
  canSpawn: boolean;
  reason: string | null;
}

/** notFound/unknown genuinely can't spawn; everything else (incl. the pending null) may, with the
 *  footer warning carrying the caveat for outdated/loggedOut. */
export function spawnGate(status: CliStatus | null): SpawnGate {
  if (!status) return { canSpawn: true, reason: null };
  if (status.kind === "notFound" || status.kind === "unknown") {
    return {
      canSpawn: false,
      reason:
        "Claude Code CLI isn't usable — see the status at the bottom of the rail.",
    };
  }
  return { canSpawn: true, reason: null };
}
