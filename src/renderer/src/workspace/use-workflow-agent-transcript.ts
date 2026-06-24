import { useCallback } from "react";
import type { TranscriptDoc } from "@shared/transcript";
import { usePolledRead, type Read } from "./use-polled-read";
import type { DocState } from "./use-transcript";

/**
 * Poll one workflow agent's own transcript on an interval. The read closes over `runId` + `agentId`, so
 * usePolledRead resets when the selected agent changes; it's disabled until both are set. Lifted to
 * WorkspaceBody so the poll survives the Terminal/Transcript toggle.
 */
export function useWorkflowAgentTranscript(
  sessionId: string,
  runId: string | undefined,
  agentId: string | undefined,
): DocState {
  const read = useCallback(
    (id: string, since?: number): Promise<Read<TranscriptDoc>> =>
      runId === undefined || agentId === undefined
        ? Promise.resolve({ status: "absent" })
        : window.api
            .readWorkflowAgentTranscript(id, runId, agentId, since)
            .then((r) =>
              r.status === "changed"
                ? { status: "changed", mtimeMs: r.mtimeMs, data: r.doc }
                : r,
            ),
    [runId, agentId],
  );
  return usePolledRead(
    sessionId,
    read,
    runId !== undefined && agentId !== undefined,
  );
}
