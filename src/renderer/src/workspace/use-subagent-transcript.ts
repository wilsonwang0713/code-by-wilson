import { useCallback } from "react";
import type { TranscriptDoc } from "@shared/transcript";
import { usePolledRead, type Read } from "./use-polled-read";
import type { DocState } from "./use-transcript";

/**
 * Poll one subagent's own transcript on an interval, returning the latest doc. A clone of useTranscript
 * keyed on the subagent: the read closes over `agentId`, so usePolledRead (which resets on the read's
 * identity) starts fresh when the drilled agent changes. Lifted to WorkspaceBody and called with the
 * active agent (or `undefined` when nothing is drilled), so the poll survives the Managed Terminal ⇄
 * Transcript toggle instead of re-reading the whole file on every flip; `undefined` disables it.
 */
export function useSubagentTranscript(
  sessionId: string,
  agentId: string | undefined,
): DocState {
  // Inline (not a module-level const like useTranscript's reader) so it can close over agentId. useCallback
  // keeps the identity stable per agent; changing agent mints a new reader, which resets the poll via
  // usePolledRead's read-identity effect dep.
  const read = useCallback(
    (id: string, since?: number): Promise<Read<TranscriptDoc>> =>
      agentId === undefined
        ? Promise.resolve({ status: "absent" })
        : window.api
            .readSubagentTranscript(id, agentId, since)
            .then((r) =>
              r.status === "changed"
                ? { status: "changed", mtimeMs: r.mtimeMs, data: r.doc }
                : r,
            ),
    [agentId],
  );
  return usePolledRead(sessionId, read, agentId !== undefined);
}
