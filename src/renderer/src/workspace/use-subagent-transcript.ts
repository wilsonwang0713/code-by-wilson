import { useCallback } from "react";
import type { TranscriptDoc } from "@shared/transcript";
import { usePolledRead, type Read } from "./use-polled-read";
import type { DocState } from "./use-transcript";

/**
 * Poll one subagent's own transcript on an interval, returning the latest doc. A clone of useTranscript
 * keyed on the subagent: the read closes over `agentId`, so usePolledRead (which resets on the read's
 * identity) starts fresh when the drilled agent changes. Mounted only while a lane is drilled, so it
 * starts and stops itself; liveness falls out of the existing poll cadence.
 */
export function useSubagentTranscript(
  sessionId: string,
  agentId: string,
): DocState {
  // Inline (not a module-level const like useTranscript's reader) so it can close over agentId. useCallback
  // keeps the identity stable per agent; changing agent mints a new reader, which resets the poll via
  // usePolledRead's read-identity effect dep.
  const read = useCallback(
    (id: string, since?: number): Promise<Read<TranscriptDoc>> =>
      window.api
        .readSubagentTranscript(id, agentId, since)
        .then((r) =>
          r.status === "changed"
            ? { status: "changed", mtimeMs: r.mtimeMs, data: r.doc }
            : r,
        ),
    [agentId],
  );
  return usePolledRead(sessionId, read);
}
