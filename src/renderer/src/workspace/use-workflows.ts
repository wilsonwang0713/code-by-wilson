import type { WorkflowRunSummary } from "@shared/types";
import { usePolledRead, type Read } from "./use-polled-read";

// `undefined` until the first read; `null` when the session has no workflows dir; a list once read.
export type WorkflowsState = WorkflowRunSummary[] | null | undefined;

/** Adapt the workflows IPC result into the uniform Read shape (its payload key is `runs`). */
const readWorkflows = (
  id: string,
  since?: number,
): Promise<Read<WorkflowRunSummary[]>> =>
  window.api
    .readWorkflows(id, since)
    .then((r) =>
      r.status === "changed"
        ? { status: "changed", mtimeMs: r.mtimeMs, data: r.runs }
        : r,
    );

/** Poll one session's workflow-run list on an interval. Mirrors useShells via the shared hook. */
export function useWorkflows(sessionId: string): WorkflowsState {
  return usePolledRead(sessionId, readWorkflows);
}
