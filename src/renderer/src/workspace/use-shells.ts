import type { BackgroundShell } from "@shared/types";
import { usePolledRead, type Read } from "./use-polled-read";

// `undefined` until the first read; `null` when the session has no transcript; a list once read.
export type ShellsState = BackgroundShell[] | null | undefined;

/** Adapt the shells IPC result into the uniform Read shape (its payload key is `shells`). Module-level so
 *  the hook's effect sees a stable reference. */
const readShells = (
  id: string,
  since?: number,
): Promise<Read<BackgroundShell[]>> =>
  window.api
    .readShells(id, since)
    .then((r) =>
      r.status === "changed"
        ? { status: "changed", mtimeMs: r.mtimeMs, data: r.shells }
        : r,
    );

/** Poll one session's background-shell list on an interval. Mirrors useTasks via the shared hook. */
export function useShells(sessionId: string): ShellsState {
  return usePolledRead(sessionId, readShells);
}
