import { useCallback } from "react";
import type { WorkflowRun } from "@shared/types";
import { usePolledRead, type Read } from "./use-polled-read";

export type WorkflowRunState = WorkflowRun | null | undefined;

/**
 * Poll one workflow run's full record on an interval. The read closes over `runId`, so usePolledRead
 * resets when the drilled run changes; `undefined` disables it. Lifted to WorkspaceBody and called with
 * the active run id (or undefined when nothing is drilled).
 */
export function useWorkflowRun(
  sessionId: string,
  runId: string | undefined,
): WorkflowRunState {
  const read = useCallback(
    (id: string, since?: number): Promise<Read<WorkflowRun>> =>
      runId === undefined
        ? Promise.resolve({ status: "absent" })
        : window.api
            .readWorkflowRun(id, runId, since)
            .then((r) =>
              r.status === "changed"
                ? { status: "changed", mtimeMs: r.mtimeMs, data: r.run }
                : r,
            ),
    [runId],
  );
  return usePolledRead(sessionId, read, runId !== undefined);
}
